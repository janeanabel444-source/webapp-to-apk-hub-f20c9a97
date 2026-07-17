import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SUPER_ADMIN_EMAIL = "paschalsoromtochukwu@gmail.com";

async function assertAdmin(userId: string, email: string | undefined) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if ((email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL) return;
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admin only");
}

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as any)?.email as string | undefined;
    if ((email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL) return { admin: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { admin: !!data };
  });

export const adminListReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, (context.claims as any)?.email);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("reports")
      .select("*, app:apps(id, slug, name, icon_url, status)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpdateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["open", "reviewing", "resolved", "dismissed"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, (context.claims as any)?.email);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("reports").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminToggleFeatured = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ appId: z.string().uuid(), featured: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, (context.claims as any)?.email);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("apps")
      .update({ is_featured: data.featured, featured_at: data.featured ? new Date().toISOString() : null })
      .eq("id", data.appId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetAppStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      appId: z.string().uuid(),
      status: z.enum(["live", "pending", "rejected", "suspended", "draft"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, (context.claims as any)?.email);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("apps")
      .update({ status: data.status, is_published: data.status === "live" })
      .eq("id", data.appId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListApps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, (context.claims as any)?.email);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("apps")
      .select("id, slug, name, icon_url, category, status, is_featured, install_count, download_count, developer_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Increment download count via service role (called from a client after successful download). */
export const trackDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ appId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("increment_download" as any, { _app_id: data.appId }).select();
    // RPC lives in `private` schema — service-role can still update the column directly as a fallback.
    if (error) {
      await supabaseAdmin
        .from("apps")
        .update({ download_count: (undefined as any) })
        .eq("id", data.appId);
      // simpler: raw increment via SQL
      const { data: row } = await supabaseAdmin.from("apps").select("download_count").eq("id", data.appId).maybeSingle();
      await supabaseAdmin
        .from("apps")
        .update({ download_count: ((row?.download_count as number) ?? 0) + 1 })
        .eq("id", data.appId);
    }
    return { ok: true };
  });
