// Resumable, chunked APK upload to the private `app-files` bucket over the
// TUS protocol, plus a Screen Wake Lock so a mobile device never sleeps in
// the middle of an upload.
//
// - 6 MB chunks, automatic retry with backoff.
// - The TUS upload URL is persisted locally after every progress tick, so an
//   interrupted or dropped upload resumes from the byte where it stopped the
//   next time the same file is selected (progress persistence).
// - Cancel is real: the upload is aborted on the server, not just abandoned.
// - Resilient fallback: if chunked initialization fails (e.g. the storage
//   TUS route is unavailable), the upload transparently continues with the
//   standard signed-URL upload instead of failing.
import * as tus from "tus-js-client";
import { supabase } from "@/integrations/supabase/client";

export const APK_BUCKET = "app-files";
export const APK_MAX_BYTES = 80 * 1024 * 1024; // must match the bucket limit

const CHUNK_SIZE = 6 * 1024 * 1024; // 6 MB
const RETRY_DELAYS = [0, 3000, 5000, 10000, 20000];
const RESUME_PREFIX = "niza-upload:";

/** Thrown when the caller cancels an upload. */
export class UploadCancelled extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadCancelled";
  }
}

// ── Screen Wake Lock ─────────────────────────────────────────────────────
// Keeps the screen on during long uploads; re-acquires after the app is
// backgrounded and returns to the foreground. Never throws.
export async function holdScreenAwake(): Promise<{ release: () => Promise<void> }> {
  let lock: { release?: () => Promise<void> } | null = null;
  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { wakeLock?: { request?: (t: string) => Promise<any> } }) : null;

  const acquire = async () => {
    try {
      if (nav?.wakeLock?.request) lock = await nav.wakeLock.request("screen");
    } catch {
      /* not supported or denied — uploading continues normally */
    }
  };
  await acquire();

  const onVisible = () => {
    if (document.visibilityState === "visible" && !lock) void acquire();
  };
  document.addEventListener("visibilitychange", onVisible);

  const release = async () => {
    document.removeEventListener("visibilitychange", onVisible);
    try {
      await lock?.release?.();
    } catch {
      /* already released */
    }
    lock = null;
  };
  return { release };
}

// ── Resume persistence ───────────────────────────────────────────────────
function fileFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function persistApkResume(file: File, url: string) {
  try {
    if (url) localStorage.setItem(RESUME_PREFIX + fileFingerprint(file), url);
  } catch {
    /* storage full/blocked — resume just won't be available */
  }
}

function readApkResume(file: File): string | null {
  try {
    return localStorage.getItem(RESUME_PREFIX + fileFingerprint(file));
  } catch {
    return null;
  }
}

export function clearApkResume(file: File) {
  try {
    localStorage.removeItem(RESUME_PREFIX + fileFingerprint(file));
  } catch {
    /* ignore */
  }
}

// ── TUS upload ───────────────────────────────────────────────────────────
export type ResumableUploadHandle = {
  promise: Promise<{ path: string }>;
  /** Aborts the upload on the server and cleans up the resume record. */
  cancel: () => Promise<void>;
  /** True when chunked upload was unavailable and the standard upload is used. */
  usingFallback: () => boolean;
};

/**
 * Upload an APK with the TUS resumable protocol. Progress comes from real
 * byte counts. If the upload fails, the returned promise rejects with an
 * error carrying a `retry()` that continues from the last committed chunk.
 * When chunked initialization fails (404 on the TUS route, unsupported,
 * blocked), the upload falls back to the standard signed-URL upload.
 */
export function uploadApkResumable(opts: {
  userId: string;
  file: File;
  onProgress: (loaded: number, total: number) => void;
}): ResumableUploadHandle {
  const { userId, file, onProgress } = opts;
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.apk`;
  // Supabase Storage resumable (TUS) endpoint.
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/upload/resumable`;

  let upload: tus.Upload | null = null;
  let fallbackUsed = false;
  let fallbackXhr: XMLHttpRequest | null = null;
  let cancelled = false;
  let fail: ((e: unknown) => void) | null = null;
  const promise = new Promise<{ path: string }>((resolve, reject) => {
    fail = (e) => reject(e);
    void (async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        reject(new Error("Please sign in to upload."));
        return;
      }
      if (cancelled) {
        reject(new UploadCancelled());
        return;
      }

      const resolveDone = () => {
        clearApkResume(file);
        resolve({ path });
      };

      // ── Standard fallback upload (signed upload URL, no chunking) ──
      // The supabase-js signed upload has no progress callback, so the raw
      // XHR below mirrors the exact same request while reporting real bytes.
      const startFallback = async () => {
        fallbackUsed = true;
        const signed = await supabase.storage.from(APK_BUCKET).createSignedUploadUrl(path);
        if (signed.error || !signed.data) {
          reject(new Error(signed.error?.message ?? "Upload initialization failed."));
          return;
        }
        try {
          await new Promise<void>((res, rej) => {
            const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/upload/sign/${APK_BUCKET}/${path}?token=${encodeURIComponent(signed.data!.token)}`;
            const form = new FormData();
            form.append("cacheControl", "3600");
            form.append("", file);
            const xhr = new XMLHttpRequest();
            fallbackXhr = xhr;
            xhr.open("POST", url);
            xhr.setRequestHeader("authorization", `Bearer ${token}`);
            const apiKey =
              (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
              (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);
            if (apiKey) xhr.setRequestHeader("apikey", apiKey);
            xhr.upload.onprogress = (e) => {
              if (!cancelled) onProgress(e.loaded, e.total);
            };
            xhr.onload = () => {
              if (cancelled) return;
              if (xhr.status >= 200 && xhr.status < 300) res();
              else rej(new Error(`Upload failed (${xhr.status}). Please try again.`));
            };
            xhr.onerror = () => rej(new Error("Upload failed — network error. Please try again."));
            xhr.send(form);
          });
          resolveDone();
        } catch (e) {
          reject(e);
        }
      };

      upload = new tus.Upload(file, {
        endpoint,
        uploadSize: file.size,
        chunkSize: CHUNK_SIZE,
        retryDelays: RETRY_DELAYS,
        // Resume a previously interrupted upload of this exact file.
        uploadUrl: readApkResume(file) ?? undefined,
        headers: { authorization: `Bearer ${token}` },
        metadata: {
          bucketname: APK_BUCKET,
          objectname: path,
          contenttype: "application/vnd.android.package-archive",
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          if (upload?.url) persistApkResume(file, upload.url);
          onProgress(bytesUploaded, bytesTotal);
        },
        onSuccess: () => {
          clearApkResume(file);
          resolve({ path });
        },
        onError: (error) => {
          if (upload?.url) persistApkResume(file, upload.url);
          // Chunked initialization failed before a single byte was stored
          // (route missing / 404 / unsupported) — continue with the standard
          // upload instead of failing the developer's publish.
          const msg = (error as Error)?.message ?? "";
          if (!upload?.url && !fallbackUsed && /creating upload|response code: 4\d\d|not found|unsupported/i.test(msg)) {
            clearApkResume(file);
            void startFallback();
            return;
          }
          Object.assign(error as Error, {
            retryable: true,
            retry: () => upload?.start(),
          });
          reject(error);
        },
      });
      upload.start();
    })();
  });

  const cancel = async () => {
    cancelled = true;
    try {
      await upload?.abort(true);
    } catch {
      /* already finished or never started */
    }
    try {
      fallbackXhr?.abort();
    } catch {
      /* not running */
    }
    clearApkResume(file);
    fail?.(new UploadCancelled());
  };

  return { promise, cancel, usingFallback: () => fallbackUsed };
}
