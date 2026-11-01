// Server-only APK inspection. Verifies the binary AndroidManifest.xml and the
// APK signing block / v1 signature directly — the client's parsed values are
// never trusted for security decisions. Pure JavaScript (fflate + manual
// binary parsing) so it runs on the edge worker runtime; only Web Crypto
// (crypto.subtle) is used for hashing.
import { unzipSync } from "fflate";
import { parseAxml } from "@/lib/axml";

/** Zero-tolerance permissions — the upload is rejected, never sent to review. */
export const FORBIDDEN_PERMISSIONS = [
  "android.permission.READ_SMS",
  "android.permission.RECEIVE_SMS",
  "android.permission.SEND_SMS",
  "android.permission.BIND_ACCESSIBILITY_SERVICE",
  "android.permission.REQUEST_INSTALL_PACKAGES",
] as const;

export type ApkSecurityReport = {
  packageName: string | null;
  versionName: string | null;
  versionCode: number | null;
  permissions: string[];
  certFingerprintSha256: string | null;
  signingSchemes: string[];
  sha256: string;
  sizeBytes: number;
};

export class ForbiddenPermissionError extends Error {}
export class CertificateMismatchError extends Error {}

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(":").toUpperCase();

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return hex(await crypto.subtle.digest("SHA-256", copy.buffer));
}

// ---------------------------------------------------------------------------
// Minimal DER walking (for v1 JAR signatures: PKCS#7 -> X.509 certificate)
// ---------------------------------------------------------------------------

/** Reads a DER TLV at `off`; returns { tag, start, contentStart, contentLen, next }. */
function readTlv(b: Uint8Array, off: number) {
  if (off + 2 > b.length) throw new Error("DER truncated");
  const tag = b[off]!;
  let len = b[off + 1]!;
  let next = off + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4) throw new Error("DER bad length");
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + b[next++]!;
  }
  return { tag, start: off, contentStart: next, contentLen: len, next: next + len };
}

function children(b: Uint8Array, start: number, end: number) {
  const out: ReturnType<typeof readTlv>[] = [];
  let off = start;
  while (off < end) {
    const t = readTlv(b, off);
    out.push(t);
    off = t.next;
  }
  return out;
}

/** Extracts the first X.509 certificate DER from a PKCS#7 signed-data blob. */
function extractV1Certificate(p7: Uint8Array): Uint8Array | null {
  try {
    const root = readTlv(p7, 0); // ContentInfo SEQUENCE
    const kids = children(p7, root.contentStart, root.next);
    // [0] EXPLICIT containing SignedData
    const outer = kids.find((k) => k.tag === 0xa0);
    if (!outer) return null;
    const signedData = readTlv(p7, outer.contentStart); // SEQUENCE
    const sdKids = children(p7, signedData.contentStart, signedData.next);
    // certificates live in the [0] IMPLICIT after version/digests/contentInfo
    const certs = sdKids.find((k) => k.tag === 0xa0);
    if (!certs) return null;
    const first = readTlv(p7, certs.contentStart); // Certificate SEQUENCE (full TLV)
    return p7.subarray(first.start, first.next);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// APK Signing Block (v2 / v3) — certificate extraction
// ---------------------------------------------------------------------------

const APK_SIG_BLOCK_MAGIC = "APK Sig Block 42";
const V2_BLOCK_ID = 0x7109871a;
const V3_BLOCK_ID = 0xf05368c0;

const u32 = (b: Uint8Array, o: number) => (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;
const u64 = (b: Uint8Array, o: number) => u32(b, o) + u32(b, o + 4) * 2 ** 32;

/** Parses one length-prefixed sequence (uint32 LE lengths). */
function lpSequence(b: Uint8Array, start: number, end: number) {
  const out: Array<[number, number]> = []; // [start, end]
  let off = start;
  while (off + 4 <= end) {
    const len = u32(b, off);
    off += 4;
    out.push([off, off + len]);
    off += len;
  }
  return out;
}

function extractSigningBlockCertificate(bytes: Uint8Array): Uint8Array | null {
  // The magic sits in the last 24 bytes before the central directory.
  const scanFrom = Math.max(0, bytes.length - 16 * 1024 * 1024);
  const tail = bytes.subarray(scanFrom);
  let magicOff = -1;
  for (let i = tail.length - 16; i >= 0; i--) {
    if (tail[i] === 0x41 && tail[i + 1] === 0x50 && tail[i + 2] === 0x4b) {
      // Cheap ASCII check then full compare: "APK Sig Block 42"
      let ok = true;
      for (let j = 0; j < 16; j++) {
        const c = tail[i + j]!;
        const expect = APK_SIG_BLOCK_MAGIC.charCodeAt(j);
        if (c !== expect) { ok = false; break; }
      }
      if (ok) { magicOff = scanFrom + i; break; }
    }
  }
  if (magicOff < 0) return null;

  try {
    const blockSize = u64(bytes, magicOff - 8);
    const blockStart = magicOff + 16 - blockSize - 8;
    if (blockStart < 0) return null;
    let off = blockStart + 8;
    const pairsEnd = magicOff - 8;
    while (off + 12 <= pairsEnd) {
      const pairLen = u64(bytes, off);
      const id = u32(bytes, off + 8);
      if (id === V2_BLOCK_ID || id === V3_BLOCK_ID) {
        const valStart = off + 12;
        const valEnd = off + 8 + pairLen;
        const signers = lpSequence(bytes, valStart, valEnd);
        if (!signers.length) return null;
        const [s0] = signers;
        const parts = lpSequence(bytes, s0[0], s0[1]); // signedData, signatures, publicKey
        if (parts.length < 1) return null;
        const sdParts = lpSequence(bytes, parts[0][0], parts[0][1]); // digests, certificates, attrs
        if (sdParts.length < 2) return null;
        const certs = lpSequence(bytes, sdParts[1][0], sdParts[1][1]);
        if (!certs.length) return null;
        return bytes.subarray(certs[0][0], certs[0][1]);
      }
      off += 8 + pairLen;
    }
  } catch {
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function inspectApkBytes(bytes: Uint8Array): Promise<ApkSecurityReport> {
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(bytes);
  } catch {
    throw new Error("This file is not a valid Android APK package.");
  }
  const manifest = zip["AndroidManifest.xml"];
  if (!manifest) throw new Error("This file does not contain an AndroidManifest.xml — it is not a valid APK.");

  const elements = parseAxml(manifest);
  const manifestEl = elements.find((e) => e.name === "manifest");
  const permissions = [
    ...new Set(
      elements
        .filter((e) => e.name === "uses-permission" || e.name === "uses-permission-sdk-23")
        .map((e) => e.attrs["name"]?.value ?? "")
        .filter(Boolean),
    ),
  ].sort();

  // Certificate fingerprint: prefer the APK Signing Block (v2/v3), fall back
  // to the v1 JAR signature.
  let certDer: Uint8Array | null = extractSigningBlockCertificate(bytes);
  const schemes: string[] = [];
  if (certDer) schemes.push("v2/v3 (APK Signing Block)");
  if (!certDer) {
    const signerName = Object.keys(zip).find((n) => /^META-INF\/.+\.(RSA|DSA|EC)$/i.test(n));
    if (signerName) {
      const der = extractV1Certificate(zip[signerName]!);
      if (der) { certDer = der; schemes.push("v1 (JAR)"); }
    }
  }
  const certFingerprintSha256 = certDer ? await sha256Hex(certDer) : null;

  const versionCodeAttr = manifestEl?.attrs["versionCode"];
  const versionCode =
    versionCodeAttr && versionCodeAttr.type === 0x10 ? versionCodeAttr.raw : null;

  return {
    packageName: manifestEl?.attrs["package"]?.value ?? null,
    versionName: manifestEl?.attrs["versionName"]?.value ?? null,
    versionCode: typeof versionCode === "number" ? versionCode : null,
    permissions,
    certFingerprintSha256,
    signingSchemes: schemes,
    sha256: await sha256Hex(bytes),
    sizeBytes: bytes.length,
  };
}

export function findForbiddenPermissions(permissions: string[]): string[] {
  return permissions.filter((p) => (FORBIDDEN_PERMISSIONS as readonly string[]).includes(p));
}

/** Throws a clear, developer-facing error when a forbidden permission is present. */
export function assertNoForbiddenPermissions(permissions: string[]) {
  const hit = findForbiddenPermissions(permissions);
  if (hit.length) {
    throw new ForbiddenPermissionError(
      `Your APK requests the forbidden permission ${hit[0]}. ` +
        "Apps on Niza are not allowed to read or send SMS, use accessibility services, or install other packages. " +
        "Remove this permission from your AndroidManifest.xml, rebuild and sign your APK, then upload it again.",
    );
  }
}

/**
 * Downloads the APK from the private app-files bucket and inspects it.
 * Throws ForbiddenPermissionError / CertificateMismatchError / readable errors.
 */
export async function inspectApkFromStorage(filePath: string): Promise<ApkSecurityReport> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: blob, error } = await supabaseAdmin.storage.from("app-files").download(filePath);
  if (error || !blob) throw new Error("The uploaded APK could not be read back from storage.");
  return inspectApkBytes(new Uint8Array(await blob.arrayBuffer()));
}
