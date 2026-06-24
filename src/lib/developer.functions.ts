import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

const appInput = z.object({
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(160).optional().nullable(),
  description: z.string().trim().min(10).max(4000),
  category: z.enum(["app", "game"]),
  platform: z.enum(["web", "pwa", "android"]),
  icon_url: z.string().url(),
  app_url: z.string().url().optional().nullable(),
  file_path: z.string().min(1).optional().nullable(),
  screenshots: z.array(z.string().url()).max(8).default([]),
});

export const createDeveloperApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => appInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!data.app_url && !data.file_path) {
      throw new Error("Provide an app URL or upload an app file.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const base = slugify(data.name) || "app";
    const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const { data: row, error } = await supabaseAdmin
      .from("apps")
      .insert({
        developer_id: context.userId,
        slug,
        name: data.name,
        tagline: data.tagline ?? null,
        description: data.description,
        category: data.category,
        platform: data.platform,
        icon_url: data.icon_url,
        app_url: data.app_url ?? null,
        file_path: data.file_path ?? null,
        screenshots: data.screenshots,
        is_published: true,
        status: "pending",
      })
      .select("id, slug, status")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateDeveloperApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    appInput.partial().extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { data: existing } = await supabaseAdmin
      .from("apps")
      .select("developer_id, status")
      .eq("id", id)
      .maybeSingle();
    if (!existing || existing.developer_id !== context.userId) {
      throw new Error("Not found");
    }
    const { error } = await supabaseAdmin
      .from("apps")
      .update({ ...patch, status: existing.status === "live" ? "live" : "pending" })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyDeveloperApps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("apps")
      .select("id, slug, name, category, platform, icon_url, status, install_count, created_at, updated_at")
      .eq("developer_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyDeveloperApp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("apps")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.developer_id !== context.userId) throw new Error("Not found");
    return row;
  });

export const deleteDeveloperApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("apps")
      .select("developer_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing || existing.developer_id !== context.userId) throw new Error("Not found");
    const { error } = await supabaseAdmin.from("apps").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
