// VirusTotal scanning queue (server-only). Uploads are gated fail-closed:
// while a scan is pending/queued the app stays in the "verifying" state and
// is never published to the public feed. Any verdict of malicious > 0
// immediately rejects the APK.
//
// Rate limiting: at most ONE VirusTotal API request every 15 seconds
// (4/min), enforced through the persistent vt_rate_state table so the limit
// holds across worker restarts. If a request would be too soon, the pass
// stops and the queue waits for the next trigger (developer hub load, the
// public tick endpoint, or the next upload).
import { createHash } from "crypto";

const MIN_INTERVAL_MS = 15_000;
/** VirusTotal free-tier file upload cap. */
const VT_UPLOAD_LIMIT_BYTES = 32 * 1024 * 1024;
const VT_API = "https://www.virustotal.com/api/v3";

type SupabaseAdmin = import("@supabase/supabase-js").SupabaseClient<any>;

async function admin(): Promise<SupabaseAdmin> {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin as SupabaseAdmin;
}

function apiKey(): string | undefined {
  return process.env.VIRUSTOTAL_API_KEY;
}

/** True when VirusTotal has no API key configured — scans pass through unscanned. */
export function vtConfigured() {
  return !!apiKey();
}

// ---------------------------------------------------------------------------
// Throttled VT access: ≤1 request / 15s, persisted in vt_rate_state
// ---------------------------------------------------------------------------

/** Returns true if the caller may make the next VT request, and records it. */
async function claimVtSlot(db: SupabaseAdmin): Promise<boolean> {
  // Atomic claim: only succeeds when the last request is at least 15s old.
  const cutoff = new Date(Date.now() - MIN_INTERVAL_MS).toISOString();
  const { count } = await db
    .from("vt_rate_state")
    .update({ last_request_at: new Date().toISOString() })
    .lt("last_request_at", cutoff)
    .eq("id", 1)
    .select();
  return (count ?? 0) > 0;
}

async function vtFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const key = apiKey();
  if (!key) return null;
  const db = await admin();
  if (!(await claimVtSlot(db))) return null;
  return fetch(`${VT_API}${path}`, {
    ...init,
    headers: { "x-apikey": key, Accept: "application/json", ...(init?.headers ?? {}) },
  });
}

// ---------------------------------------------------------------------------
// Verdict application
// ---------------------------------------------------------------------------

type QueueRow = {
  id: string;
  app_id: string;
  app_version_id: string | null;
  file_path: string;
  sha256: string | null;
  size_bytes: number | null;
  status: string;
  attempts: number;
  analysis_id: string | null;
};

function statsToVerdict(stats: Record<string, number>) {
  const positives = (stats.malicious ?? 0) + (stats.suspicious ?? 0);
  const total =
    (stats.malicious ?? 0) + (stats.suspicious ?? 0) + (stats.harmless ?? 0) + (stats.undetected ?? 0);
  return { malicious: positives > 0, positives, total };
}

async function applyVerdict(db: SupabaseAdmin, row: QueueRow, verdict: {
  kind: "clean" | "malicious" | "no-verdict";
  positives?: number;
  total?: number;
  scanId?: string | null;
  permalink?: string | null;
}) {
  const versionPatch: Record<string, unknown> = {
    vt_positives: verdict.positives ?? 0,
    vt_total: verdict.total ?? 0,
    vt_permalink: verdict.permalink ?? null,
    vt_scan_id: verdict.scanId ?? null,
  };
  if (row.app_version_id) {
    await db.from("app_versions").update(versionPatch).eq("id", row.app_version_id);
  } else {
    const { data: latest } = await db
      .from("app_versions")
      .select("id")
      .eq("app_id", row.app_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest) await db.from("app_versions").update(versionPatch).eq("id", latest.id);
  }

  if (verdict.kind === "malicious") {
    await db
      .from("apps")
      .update({
        scan_status: "malicious",
        status: "rejected",
        is_published: false,
        review_note: `Rejected automatically: VirusTotal flagged this file (malicious in ${verdict.positives} of ${verdict.total} engines). The package may not be uploaded again.`,
      })
      .eq("id", row.app_id);
    await db.storage.from("app-files").remove([row.file_path]).catch(() => {});
    await db.from("vt_scan_queue").update({ status: "malicious", updated_at: new Date().toISOString() }).eq("id", row.id);
    return;
  }

  const scanStatus = verdict.kind === "clean" ? "clean" : "unscanned";
  // Re-read current status so we only transition apps that are waiting on the scan.
  const { data: app } = await db.from("apps").select("status, review_note, release_channel").eq("id", row.app_id).maybeSingle();
  if (app && app.status === "verifying") {
    if (verdict.kind === "clean" && !app.review_note && app.release_channel !== "development") {
      await db.from("apps").update({ scan_status: scanStatus, status: "live", is_published: true }).eq("id", row.app_id);
    } else {
      const note =
        verdict.kind === "clean"
          ? app.review_note
          : `${app.review_note ? app.review_note + "\n\n" : ""}VirusTotal could not produce a verdict for this file${(row.size_bytes ?? 0) > VT_UPLOAD_LIMIT_BYTES ? " (it is too large for automated analysis)" : ""}. Manual review is required before it can go live.`;
      await db
        .from("apps")
        .update({ scan_status: scanStatus, status: "pending", is_published: false, review_note: note })
        .eq("id", row.app_id);
    }
  } else if (app) {
    await db.from("apps").update({ scan_status: scanStatus }).eq("id", row.app_id);
  }
  await db.from("vt_scan_queue").update({ status: verdict.kind === "clean" ? "clean" : "no-verdict", updated_at: new Date().toISOString() }).eq("id", row.id);
}

// ---------------------------------------------------------------------------
// Queue processing
// ---------------------------------------------------------------------------

async function processRow(db: SupabaseAdmin, row: QueueRow): Promise<boolean> {
  const permalink = row.sha256 ? `https://www.virustotal.com/gui/file/${row.sha256}` : null;

  if (row.status === "poll" && row.analysis_id) {
    const res = await vtFetch(`/analyses/${row.analysis_id}`);
    if (!res) return false; // rate slot unavailable
    if (!res.ok) { await bumpAttempts(db, row, `analysis poll ${res.status}`); return res.status !== 404; }
    const body = (await res.json()) as any;
    const st = body?.data?.attributes?.status;
    if (st === "completed") {
      const verdict = statsToVerdict(body?.data?.attributes?.stats ?? {});
      await applyVerdict(db, row, { ...verdict, kind: verdict.malicious ? "malicious" : "clean", scanId: row.analysis_id, permalink });
    }
    return true; // still queued/in-progress — try again on the next pass
  }

  // status 'pending' — need the file hash, then a lookup or upload.
  let sha256 = row.sha256;
  if (!sha256) {
    const { data: blob, error } = await db.storage.from("app-files").download(row.file_path);
    if (error || !blob) {
      await bumpAttempts(db, row, "file missing from storage");
      await db.from("vt_scan_queue").update({ status: "error", updated_at: new Date().toISOString() }).eq("id", row.id);
      return true;
    }
    sha256 = createHash("sha256").update(Buffer.from(await blob.arrayBuffer())).digest("hex");
    await db.from("vt_scan_queue").update({ sha256, updated_at: new Date().toISOString() }).eq("id", row.id);
  }

  const lookup = await vtFetch(`/files/${sha256}`);
  if (!lookup) return false;
  if (lookup.status === 429) { await bumpAttempts(db, row, "rate limited"); return true; }
  if (lookup.ok) {
    const body = (await lookup.json()) as any;
    const verdict = statsToVerdict(body?.data?.attributes?.last_analysis_stats ?? {});
    await applyVerdict(db, row, {
      kind: verdict.malicious ? "malicious" : "clean",
      positives: verdict.positives,
      total: verdict.total,
      scanId: body?.data?.id ?? null,
      permalink,
    });
    return true;
  }
  if (lookup.status !== 404) { await bumpAttempts(db, row, `lookup ${lookup.status}`); return true; }

  // Unknown to VirusTotal — upload the file for analysis when possible.
  if ((row.size_bytes ?? 0) > VT_UPLOAD_LIMIT_BYTES) {
    await applyVerdict(db, row, { kind: "no-verdict", permalink });
    return true;
  }
  const { data: blob, error } = await db.storage.from("app-files").download(row.file_path);
  if (error || !blob) { await bumpAttempts(db, row, "file missing from storage"); return true; }
  const buf = await blob.arrayBuffer();
  const form = new FormData();
  form.append("file", new Blob([buf]), row.file_path.split("/").pop() ?? "app.apk");
  const upload = await vtFetch("/files", { method: "POST", body: form });
  if (!upload) return false;
  if (!upload.ok && upload.status !== 200) { await bumpAttempts(db, row, `upload ${upload.status}`); return true; }
  const upBody = (await upload.json()) as any;
  const analysisId = upBody?.data?.id ?? null;
  if (!analysisId) { await bumpAttempts(db, row, "upload returned no analysis id"); return true; }
  await db
    .from("vt_scan_queue")
    .update({ status: "poll", analysis_id: analysisId, attempts: row.attempts + 1, updated_at: new Date().toISOString() })
    .eq("id", row.id);
  if (row.app_version_id) {
    await db.from("app_versions").update({ vt_scan_id: analysisId, vt_permalink: permalink }).eq("id", row.app_version_id);
  }
  return true;
}

async function bumpAttempts(db: SupabaseAdmin, row: QueueRow, err: string) {
  await db
    .from("vt_scan_queue")
    .update({ attempts: row.attempts + 1, last_error: err, updated_at: new Date().toISOString() })
    .eq("id", row.id);
}

/**
 * Drains the scan queue, respecting the 15-second VirusTotal throttle.
 * Processes at most a handful of rows per call; safe to call from any
 * request. Returns how many rows reached a verdict.
 */
export async function drainVtScanQueue(): Promise<number> {
  if (!vtConfigured()) return 0;
  const db = await admin();
  const { data: rows } = await db
    .from("vt_scan_queue")
    .select("*")
    .in("status", ["pending", "poll"])
    .order("created_at", { ascending: true })
    .limit(10);
  let resolved = 0;
  for (const row of (rows ?? []) as unknown as QueueRow[]) {
    let progressed = false;
    try {
      progressed = await processRow(db, row);
    } catch (e: any) {
      await bumpAttempts(db, row, e?.message ?? "unknown error");
      progressed = true;
    }
    if (!progressed) break; // VT rate slot unavailable — wait for the next pass
    resolved++;
  }
  return resolved;
}

/**
 * Enqueues a scan for an uploaded APK. Fail-closed: the caller must already
 * have put the app in the "verifying" state. Throws when the exact binary is
 * already known to be malicious.
 */
export async function enqueueVtScan(opts: {
  appId: string;
  appVersionId?: string | null;
  filePath: string;
  sha256?: string | null;
  sizeBytes?: number | null;
}): Promise<void> {
  if (!vtConfigured()) return;
  const db = await admin();
  if (opts.sha256) {
    const { data: known } = await db
      .from("vt_scan_queue")
      .select("id")
      .eq("sha256", opts.sha256)
      .eq("status", "malicious")
      .limit(1)
      .maybeSingle();
    if (known) {
      throw new Error("This exact file was previously rejected by VirusTotal and cannot be uploaded again.");
    }
  }
  await db.from("vt_scan_queue").insert({
    app_id: opts.appId,
    app_version_id: opts.appVersionId ?? null,
    file_path: opts.filePath,
    sha256: opts.sha256 ?? null,
    size_bytes: opts.sizeBytes ?? null,
    status: "pending",
  });
  await db.from("apps").update({ scan_status: "verifying" }).eq("id", opts.appId);
}
