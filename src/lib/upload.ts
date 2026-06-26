import { supabase } from "@/integrations/supabase/client";

const YEAR = 60 * 60 * 24 * 365;

const ALLOWED_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const ALLOWED_IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

const ALLOWED_APP_FILE_MIME = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.android.package-archive",
  "application/octet-stream",
]);
const ALLOWED_APP_FILE_EXT = new Set(["zip", "apk"]);

const MAX_BYTES: Record<string, number> = {
  "app-logos": 2 * 1024 * 1024, // 2 MB
  "app-screenshots": 5 * 1024 * 1024, // 5 MB
  "app-files": 75 * 1024 * 1024, // 75 MB
};

/**
 * Validate the file's declared MIME type AND filename extension against an
 * allow-list before uploading. The browser-provided `file.type` can be spoofed
 * but checking both reduces the attack surface for public buckets, and the
 * sanitized contentType is what we forward to storage (never the raw user
 * value verbatim if it's outside the allow-list).
 */
function validateFile(
  bucket: "app-logos" | "app-screenshots" | "app-files",
  file: File,
): { ext: string; contentType: string } {
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

  // app-files: APK/ZIP only
  if (!ALLOWED_APP_FILE_EXT.has(ext) || !ALLOWED_APP_FILE_MIME.has(mime)) {
    throw new Error("Only .apk or .zip app bundles are allowed.");
  }
  // Force a safe binary content-type so the CDN never serves an executable script type.
  return { ext, contentType: "application/octet-stream" };
}

export async function uploadToBucket(
  bucket: "app-logos" | "app-screenshots" | "app-files",
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
