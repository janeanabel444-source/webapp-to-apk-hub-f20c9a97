// Helper to download an APK from Supabase Storage. When the app is running
// inside the Nova Android wrapper we hand the signed URL to the native
// bridge, which downloads the file and opens the system package installer.
// In a normal browser we stream the download and rely on Android Chrome's
// download notification to launch the installer.
import { supabase } from "@/integrations/supabase/client";
import { nativeBridge, isNovaAndroid } from "@/lib/native-bridge";

export async function getApkSignedUrl(filePath: string) {
  if (!filePath) throw new Error("This app has no APK file attached yet.");
  const { data, error } = await supabase.storage
    .from("app-files")
    .createSignedUrl(filePath, 60 * 60, {
      download: filePath.split("/").pop() ?? "app.apk",
    });
  if (error || !data) {
    const msg = error?.message ?? "";
    if (/not found|Object not found/i.test(msg)) {
      throw new Error("APK file is missing from storage. Please contact the developer.");
    }
    throw new Error(msg || "Could not generate download link");
  }
  return data.signedUrl;
}

/**
 * Downloads an APK. Inside the Nova Android wrapper, hands off to the native
 * installer. In a browser, streams with progress and triggers the download.
 */
export async function downloadApkWithProgress(
  filePath: string,
  appName: string,
  onProgress: (loaded: number, total: number) => void,
): Promise<{ url: string; size: number; nativeInstalled?: boolean }> {
  const signed = await getApkSignedUrl(filePath);

  // Native path — Android wrapper handles download + installer intent.
  if (isNovaAndroid()) {
    onProgress(1, 1);
    try {
      const res = await nativeBridge.installApk({
        url: signed,
        fileName: `${appName.replace(/[^a-z0-9.-]+/gi, "_")}.apk`,
      });
      return { url: signed, size: 0, nativeInstalled: !!res?.installed };
    } catch (e: any) {
      throw new Error(e?.message ?? "Native install failed");
    }
  }

  // Browser fallback — stream the file so the download notification opens the installer.
  const res = await fetch(signed);
  if (!res.ok || !res.body) {
    if (res.status === 404) throw new Error("APK file is missing from storage.");
    throw new Error(`Failed to start download (${res.status})`);
  }
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
  return /Android/i.test(navigator.userAgent) || isNovaAndroid();
}
