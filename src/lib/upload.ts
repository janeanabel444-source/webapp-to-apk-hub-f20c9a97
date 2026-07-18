import { supabase } from "@/integrations/supabase/client";

const YEAR = 60 * 60 * 24 * 365;

const ALLOWED_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const ALLOWED_IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

// APK ONLY — Nova is an Android APK marketplace. Web URLs, PWA links,
// GitHub Pages, and any other web bundle are not accepted.
const ALLOWED_APP_FILE_MIME = new Set([
  "application/vnd.android.package-archive",
  "application/octet-stream",
]);
const ALLOWED_APP_FILE_EXT = new Set(["apk"]);

const ALLOWED_VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const ALLOWED_VIDEO_EXT = new Set(["mp4", "webm", "mov"]);

const MAX_BYTES: Record<string, number> = {
  "app-logos": 2 * 1024 * 1024, // 2 MB
  "app-screenshots": 5 * 1024 * 1024, // 5 MB
  "app-files": 75 * 1024 * 1024, // 75 MB
  "app-videos": 30 * 1024 * 1024, // 30 MB
};

type Bucket = "app-logos" | "app-screenshots" | "app-files" | "app-videos";

function validateFile(bucket: Bucket, file: File): { ext: string; contentType: string } {
  const ext = (file.name.split(".").pop()?.toLowerCase() ?? "").replace(/[^a-z0-9]/g, "");
  const mime = (file.type || "").toLowerCase();

  const limit = MAX_BYTES[bucket];
  if (limit && file.size > limit) {
    throw new Error(`File is too large (max ${(limit / (1024 * 1024)).toFixed(0)}MB).`);
  }

  if (bucket === "app-logos" || bucket === "app-screenshots") {
    if (!ALLOWED_IMAGE_EXT.has(ext) || !ALLOWED_IMAGE_MIME.has(mime)) {
      throw new Error("Only PNG, JPG, WEBP or GIF images are allowed.");
    }
    return { ext, contentType: mime };
  }

  if (bucket === "app-videos") {
    if (!ALLOWED_VIDEO_EXT.has(ext) || !ALLOWED_VIDEO_MIME.has(mime)) {
      throw new Error("Only MP4, WEBM or MOV videos are allowed.");
    }
    return { ext, contentType: mime };
  }

  // app-files: APK ONLY. Reject .zip, .aab, .html, everything else.
  if (!ALLOWED_APP_FILE_EXT.has(ext) || !ALLOWED_APP_FILE_MIME.has(mime)) {
    throw new Error(
      "Only Android APK files are accepted. If you have a PWA or web app, convert it to an APK first.",
    );
  }
  return { ext, contentType: "application/vnd.android.package-archive" };
}

export async function uploadToBucket(
  bucket: Bucket,
  userId: string,
  file: File,
): Promise<{ path: string; url: string }> {
  const { ext, contentType } = validateFile(bucket, file);
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType, upsert: false });
  if (error) throw new Error(error.message);
  const { data: signed, error: sErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, YEAR);
  if (sErr || !signed) throw new Error(sErr?.message ?? "Could not sign URL");
  return { path, url: signed.signedUrl };
}
