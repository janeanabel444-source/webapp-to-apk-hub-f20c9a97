// VirusTotal scan helper. Server-only — never import from a client module.
// Reads the uploaded file from the private `app-files` bucket using the
// admin client, then queries VirusTotal by SHA-256.
//
// Returns one of:
//   { status: "clean" | "unknown" }      -> safe to publish (unknown = VT had no record yet)
//   { status: "malicious", positives, total } -> reject the upload
//
// Behavior on missing key, network error, etc. is "unknown" so legitimate
// uploads aren't blocked by an outage; the developer hub still gets to live.

import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ScanResult =
  | { status: "clean" | "unknown"; sha256?: string }
  | { status: "malicious"; positives: number; total: number; sha256: string };

export async function scanStorageFileWithVirusTotal(
  bucket: "app-files",
  path: string,
): Promise<ScanResult> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) return { status: "unknown" };

  const { data: blob, error } = await supabaseAdmin.storage.from(bucket).download(path);
  if (error || !blob) return { status: "unknown" };

  const buf = Buffer.from(await blob.arrayBuffer());
  // VT free tier file uploads are capped at 32 MB; we only hash-lookup, so size is fine.
  const sha256 = createHash("sha256").update(buf).digest("hex");

  try {
    const res = await fetch(`https://www.virustotal.com/api/v3/files/${sha256}`, {
      headers: { "x-apikey": apiKey, Accept: "application/json" },
    });
    if (res.status === 404) {
      // VT has never seen this file. Treat as unknown rather than blocking.
      return { status: "unknown", sha256 };
    }
    if (!res.ok) return { status: "unknown", sha256 };
    const body = (await res.json()) as {
      data?: { attributes?: { last_analysis_stats?: Record<string, number> } };
    };
    const stats = body.data?.attributes?.last_analysis_stats ?? {};
    const positives = (stats.malicious ?? 0) + (stats.suspicious ?? 0);
    const total =
      (stats.malicious ?? 0) +
      (stats.suspicious ?? 0) +
      (stats.harmless ?? 0) +
      (stats.undetected ?? 0);
    if (positives >= 3) {
      return { status: "malicious", positives, total, sha256 };
    }
    return { status: "clean", sha256 };
  } catch {
    return { status: "unknown", sha256 };
  }
}
