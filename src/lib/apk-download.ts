// Helper to download an APK from Supabase Storage to the device with progress.
// On Android Chrome, finishing a content-disposition: attachment download
// triggers the system notification → tap → "Open" launches the package installer.
// We can't auto-launch the installer from JS (browser sandbox); the helper
// also exposes the signed URL so callers can offer a tap-through link.
import { supabase } from "@/integrations/supabase/client";

export async function getApkSignedUrl(filePath: string) {
  const { data, error } = await supabase.storage
    .from("app-files")
    .createSignedUrl(filePath, 60 * 60, {
      download: filePath.split("/").pop() ?? "app.apk",
    });
  if (error || !data) throw new Error(error?.message ?? "Could not sign APK url");
  return data.signedUrl;
}

/**
 * Downloads an APK with streaming progress and triggers the browser's
 * download flow when complete. Returns the blob URL.
 */
export async function downloadApkWithProgress(
  filePath: string,
  appName: string,
  onProgress: (loaded: number, total: number) => void,
): Promise<{ url: string; size: number }> {
  const signed = await getApkSignedUrl(filePath);
  const res = await fetch(signed);
  if (!res.ok || !res.body) throw new Error("Failed to start download");
  const total = Number(res.headers.get("content-length") ?? 0);
  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let loaded = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(loaded, total || loaded);
  }
  const blob = new Blob(chunks, { type: "application/vnd.android.package-archive" });
  const url = URL.createObjectURL(blob);
  // Trigger the browser save → on Android this lands in Downloads and shows
  // an "Open" notification that hands the file to the package installer.
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
  return /Android/i.test(navigator.userAgent);
}
