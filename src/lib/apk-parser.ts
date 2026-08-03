// Client-only APK analysis. Runs in the browser as soon as the developer picks
// a file so the upload wizard can prefill everything the package already knows.
//
// Implemented directly on top of the zip container + binary manifest so it can
// never hang: every read is bounded and the whole analysis is wrapped in a
// timeout that always resolves or throws a readable error.
import { unzip, type Unzipped } from "fflate";
import { parseAxml } from "@/lib/axml";

export type ApkCertificate = {
  /** v1 (JAR), v2/v3 (APK Signing Block) */
  schemes: string[];
  signerFile: string | null;
  fingerprintSha256: string | null;
};

export type ParsedApk = {
  appName: string | null;
  packageName: string | null;
  versionName: string | null;
  versionCode: number | null;
  minSdk: number | null;
  targetSdk: number | null;
  compileSdk: number | null;
  apkSize: number;
  permissions: string[];
  features: string[];
  abis: string[];
  iconDataUrl: string | null;
  certificate: ApkCertificate | null;
  /** True when only the file size could be determined. */
  partial: boolean;
};

export const ANDROID_API_TO_VERSION: Record<number, string> = {
  21: "5.0", 22: "5.1", 23: "6.0", 24: "7.0", 25: "7.1", 26: "8.0", 27: "8.1",
  28: "9", 29: "10", 30: "11", 31: "12", 32: "12L", 33: "13", 34: "14", 35: "15", 36: "16",
};

export function apiLevelToAndroidVersion(api: number | null | undefined): string | null {
  if (!api) return null;
  return ANDROID_API_TO_VERSION[api] ?? null;
}

const ANALYSIS_TIMEOUT_MS = 45_000;

function emptyResult(size: number): ParsedApk {
  return {
    appName: null, packageName: null, versionName: null, versionCode: null,
    minSdk: null, targetSdk: null, compileSdk: null, apkSize: size,
    permissions: [], features: [], abis: [], iconDataUrl: null,
    certificate: null, partial: true,
  };
}

function wanted(name: string): boolean {
  if (name === "AndroidManifest.xml") return true;
  if (/^META-INF\/[^/]+\.(RSA|DSA|EC)$/i.test(name)) return true;
  if (/^res\/[^]*\.png$/i.test(name) && /(ic_launcher|icon|app_icon)/i.test(name)) return true;
  return false;
}

async function unzipSelected(bytes: Uint8Array): Promise<{ files: Unzipped; names: string[] }> {
  const names: string[] = [];
  return new Promise((resolve, reject) => {
    unzip(
      bytes,
      {
        filter: (f) => {
          names.push(f.name);
          return wanted(f.name);
        },
      },
      (err, files) => {
        if (err) reject(new Error("The APK archive could not be opened — it may be corrupted."));
        else resolve({ files, names });
      },
    );
  });
}

async function sha256Hex(data: Uint8Array): Promise<string | null> {
  try {
    const buf = new Uint8Array(data).buffer;
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(":").toUpperCase();
  } catch {
    return null;
  }
}

function hasApkSigningBlock(bytes: Uint8Array): boolean {
  const magic = "APK Sig Block 42";
  const tail = bytes.subarray(Math.max(0, bytes.length - 4 * 1024 * 1024));
  const text = new TextDecoder("latin1").decode(tail);
  return text.includes(magic);
}

function toInt(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = Number(String(v).replace(/[^0-9]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function analyze(file: File): Promise<ParsedApk> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { files, names } = await unzipSelected(bytes);

  const manifestBytes = files["AndroidManifest.xml"];
  if (!manifestBytes) throw new Error("This file does not contain an AndroidManifest.xml — it is not a valid APK.");

  const elements = parseAxml(manifestBytes);
  const manifest = elements.find((e) => e.name === "manifest");
  const usesSdk = elements.find((e) => e.name === "uses-sdk");
  const application = elements.find((e) => e.name === "application");

  const permissions = [
    ...new Set(
      elements
        .filter((e) => e.name === "uses-permission" || e.name === "uses-permission-sdk-23")
        .map((e) => e.attrs["name"]?.value ?? "")
        .filter(Boolean),
    ),
  ].sort();

  const features = [
    ...new Set(
      elements
        .filter((e) => e.name === "uses-feature")
        .map((e) => e.attrs["name"]?.value ?? "")
        .filter(Boolean),
    ),
  ].sort();

  const abis = [
    ...new Set(
      names
        .map((n) => /^lib\/([^/]+)\//.exec(n)?.[1])
        .filter((x): x is string => !!x),
    ),
  ].sort();

  // Icon: prefer the largest launcher png we extracted.
  let iconDataUrl: string | null = null;
  let bestName: string | null = null;
  let bestSize = 0;
  for (const [name, data] of Object.entries(files)) {
    if (!/\.png$/i.test(name)) continue;
    if (data.length > bestSize) {
      bestSize = data.length;
      bestName = name;
    }
  }
  if (bestName) {
    const blob = new Blob([new Uint8Array(files[bestName]!)], { type: "image/png" });
    iconDataUrl = URL.createObjectURL(blob);
  }

  // Signing information.
  const signerFile = Object.keys(files).find((n) => /^META-INF\/.+\.(RSA|DSA|EC)$/i.test(n)) ?? null;
  const schemes: string[] = [];
  if (signerFile) schemes.push("v1 (JAR)");
  if (hasApkSigningBlock(bytes)) schemes.push("v2/v3 (APK Signing Block)");
  const certificate: ApkCertificate | null = schemes.length
    ? {
        schemes,
        signerFile,
        fingerprintSha256: signerFile ? await sha256Hex(files[signerFile]!) : null,
      }
    : null;

  const versionCodeAttr = manifest?.attrs["versionCode"];
  const versionCode =
    versionCodeAttr && versionCodeAttr.type === 0x10
      ? versionCodeAttr.raw
      : toInt(versionCodeAttr?.value ?? null);

  const labelRaw = application?.attrs["label"]?.value ?? null;
  const appName = labelRaw && !labelRaw.startsWith("@") ? labelRaw : null;

  return {
    appName,
    packageName: manifest?.attrs["package"]?.value ?? null,
    versionName: manifest?.attrs["versionName"]?.value ?? null,
    versionCode,
    minSdk: toInt(usesSdk?.attrs["minSdkVersion"]?.value ?? null) ?? (usesSdk?.attrs["minSdkVersion"]?.raw ?? null) ?? null,
    targetSdk: toInt(usesSdk?.attrs["targetSdkVersion"]?.value ?? null) ?? (usesSdk?.attrs["targetSdkVersion"]?.raw ?? null) ?? null,
    compileSdk: toInt(manifest?.attrs["compileSdkVersion"]?.value ?? null),
    apkSize: file.size,
    permissions,
    features,
    abis,
    iconDataUrl,
    certificate,
    partial: false,
  };
}

/**
 * Analyze an APK. Always settles: on failure it throws a readable error, and
 * it can never spin forever thanks to the hard timeout.
 */
export async function parseApkFile(file: File): Promise<ParsedApk> {
  if (!/\.apk$/i.test(file.name)) {
    throw new Error("Only .apk packages can be analyzed.");
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Analysis took too long. The APK may be very large or damaged — try again or continue manually.")),
      ANALYSIS_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([analyze(file), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Best-effort variant used where a failure should not block the flow. */
export async function parseApkFileSafe(file: File): Promise<{ info: ParsedApk; error: string | null }> {
  try {
    return { info: await parseApkFile(file), error: null };
  } catch (e: any) {
    return { info: emptyResult(file.size), error: e?.message ?? "The APK could not be analyzed." };
  }
}

export function diffPermissions(prev: string[] | null | undefined, next: string[]) {
  const a = new Set(prev ?? []);
  const b = new Set(next);
  return {
    added: [...b].filter((x) => !a.has(x)),
    removed: [...a].filter((x) => !b.has(x)),
  };
}

export function compareVersionStrings(a: string, b: string): number {
  const pa = a.split(".").map((p) => parseInt(p.replace(/[^0-9]/g, ""), 10) || 0);
  const pb = b.split(".").map((p) => parseInt(p.replace(/[^0-9]/g, ""), 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

export function formatBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
