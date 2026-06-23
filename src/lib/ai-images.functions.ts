import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GalleryImage = {
  id: string;
  prompt: string;
  url: string;
  createdAt: string;
  creatorId: string;
  creatorName: string;
};

async function signMany(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage
    .from("ai-images")
    .createSignedUrls(paths, 60 * 60 * 24 * 365);
  if (error) throw new Error(error.message);
  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}

export const listGalleryImages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // RLS already restricts to premium users; non-premium gets empty
    const { data: premium } = await context.supabase.rpc("is_user_premium", {
      _user_id: context.userId,
    });
    if (!premium) throw new Error("PREMIUM_REQUIRED");

    const { data: rows, error } = await context.supabase
      .from("ai_images")
      .select("id, prompt, storage_path, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(120);
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? "Nova user"]));

    const urls = await signMany((rows ?? []).map((r) => r.storage_path));

    const items: GalleryImage[] = (rows ?? []).map((r) => ({
      id: r.id,
      prompt: r.prompt,
      url: urls[r.storage_path] ?? "",
      createdAt: r.created_at,
      creatorId: r.user_id,
      creatorName: nameById.get(r.user_id) ?? "Nova user",
    }));
    return items;
  });

export const listMyImages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("ai_images")
      .select("id, prompt, storage_path, created_at, user_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    const urls = await signMany((rows ?? []).map((r) => r.storage_path));
    return (rows ?? []).map<GalleryImage>((r) => ({
      id: r.id,
      prompt: r.prompt,
      url: urls[r.storage_path] ?? "",
      createdAt: r.created_at,
      creatorId: r.user_id,
      creatorName: "You",
    }));
  });

export const deleteMyImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error: gErr } = await context.supabase
      .from("ai_images")
      .select("storage_path, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!row || row.user_id !== context.userId) throw new Error("Not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from("ai-images").remove([row.storage_path]);
    const { error: dErr } = await context.supabase.from("ai_images").delete().eq("id", data.id);
    if (dErr) throw new Error(dErr.message);
    return { ok: true };
  });
