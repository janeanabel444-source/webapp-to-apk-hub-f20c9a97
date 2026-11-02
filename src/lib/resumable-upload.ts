// Resumable, chunked APK upload to the private `app-files` bucket over the
// TUS protocol, plus a Screen Wake Lock so a mobile device never sleeps in
// the middle of an upload.
//
// - 6 MB chunks, automatic retry with backoff.
// - The TUS upload URL is persisted locally after every progress tick, so an
//   interrupted or dropped upload resumes from the byte where it stopped the
//   next time the same file is selected (progress persistence).
// - Cancel is real: the upload is aborted on the server, not just abandoned.
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
};

/**
 * Upload an APK with the TUS resumable protocol. Progress comes from real
 * byte counts. If the upload fails, the returned promise rejects with an
 * error carrying a `retry()` that continues from the last committed chunk.
 */
export function uploadApkResumable(opts: {
  userId: string;
  file: File;
  onProgress: (loaded: number, total: number) => void;
}): ResumableUploadHandle {
  const { userId, file, onProgress } = opts;
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.apk`;
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/upload/tus`;

  let upload: tus.Upload | null = null;
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
    try {
      await upload?.abort(true);
    } catch {
      /* already finished or never started */
    }
    clearApkResume(file);
    fail?.(new UploadCancelled());
  };

  return { promise, cancel };
}
