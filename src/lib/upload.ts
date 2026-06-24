import { supabase } from "@/integrations/supabase/client";

const YEAR = 60 * 60 * 24 * 365;

export async function uploadToBucket(
  bucket: "app-logos" | "app-screenshots" | "app-files",
  userId: string,
  file: File,
): Promise<{ path: string; url: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  const { data: signed, error: sErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, YEAR);
  if (sErr || !signed) throw new Error(sErr?.message ?? "Could not sign URL");
  return { path, url: signed.signedUrl };
}
