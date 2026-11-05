// Helper to download an APK from Supabase Storage. When the app is running
// inside the Niza Android wrapper we hand the signed URL to the native
// bridge, which downloads the file and opens the system package installer.
// In a normal browser we stream the download and rely on Android Chrome's
// download notification to launch the installer.
import { supabase } from "@/integrations/supabase/client";
import { nativeBridge, isNizaAndroid, initNativeBridge, hasCapability, nativeDownloadApk } from "@/lib/native-bridge";

/** Error message used when the user cancels a download — callers match on it. */
export const DOWNLOAD_CANCELLED = "Download cancelled";

export function isDownloadCancelled(e: unknown): boolean {
  return e instanceof Error && e.message === DOWNLOAD_CANCELLED;
}

export async function getApkSignedUrl(filePath: string) {
  if (!filePath) throw new Error("This app has no APK file attached yet.");
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("Please sign in to download apps.");
  }
  const { data, error } = await supabase.storage
    .from("app-files")
    .createSignedUrl(filePath, 60 * 60, {
      download: filePath.split("/").pop() ?? "app.apk",
    });
  if (error || !data) {
    const msg = error?.message ?? "";
    if (/not found|Object not found/i.test(msg)) {
      throw new Error(
        "This download isn't available yet — the app is still under review or its file was removed. Please try again later.",
      );
    }
    if (/unauthorized|permission|denied|jwt/i.test(msg)) {
      throw new Error("Your session expired. Please sign in again to download.");
    }
    throw new Error(msg || "Could not generate download link");
  }
  return data.signedUrl;
}

/** Handle that lets the UI cancel an in-flight download. */
export type DownloadHandle = { cancel: () => Promise<void>; downloadId?: string };

/**
 * Downloads an APK. Inside the Niza Android wrapper, hands off to the native
 * installer. In a browser, streams with progress and triggers the download.
 * `onHandle` receives a cancel handle as soon as the download has started.
 */
export async function downloadApkWithProgress(
  filePath: string,
  appName: string,
  onProgress: (loaded: number, total: number) => void,
  downloadUrl?: string,
  onHandle?: (handle: DownloadHandle) => void,
): Promise<{ url: string; size: number; nativeInstalled?: boolean }> {
  const signed = downloadUrl ?? await getApkSignedUrl(filePath);
  const fileName = `${appName.replace(/[^a-z0-9.-]+/gi, "_")}.apk`;

  // Native path — the Android downloader owns the download and reports real bytes.
  await initNativeBridge();
  if (hasCapability("downloadApk")) {
    const absolute = new URL(signed, window.location.origin).toString();
    const job = nativeDownloadApk({ url: absolute, fileName }, onProgress);
    onHandle?.({ cancel: () => job.cancel(), downloadId: job.downloadId });
    const done = await job.done;
    let nativeInstalled = false;
    if (hasCapability("installApk")) {
      const r = await nativeBridge.installApk(job.downloadId);
      nativeInstalled = !!r?.started;
    }
    return { url: absolute, size: done.total || done.loaded, nativeInstalled };
  }

  // Browser fallback — stream the file so the download notification opens the installer.
  const controller = new AbortController();
  onHandle?.({
    cancel: async () => {
      controller.abort(new Error(DOWNLOAD_CANCELLED));
    },
  });
  const res = await fetch(signed, { signal: controller.signal });
  if (!res.ok || !res.body) {
    if (res.status === 404) throw new Error("APK file is missing from storage.");
    throw new Error(`Failed to start download (${res.status})`);
  }
  const total = Number(res.headers.get("content-length") ?? 0);
  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let loaded = 0;
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      onProgress(loaded, total || loaded);
    }
  } catch (e: any) {
    // AbortController rejects the read loop with the abort reason.
    if (controller.signal.aborted) throw new Error(DOWNLOAD_CANCELLED);
    throw e;
  }
  const blob = new Blob(chunks, { type: "application/vnd.android.package-archive" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${appName.replace(/[^a-z0-9.-]+/gi, "_")}.apk`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return { url, size: loaded };
}

export function isAndroidDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent) || isNizaAndroid();
}
