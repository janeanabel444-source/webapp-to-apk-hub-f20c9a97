import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Role = "admin" | "developer" | "jasper_ai" | "user";

export function quotaForRole(role: Role, isPremium: boolean): number {
  if (role === "admin") return Infinity;
  if (role === "jasper_ai") return 20;
  if (isPremium) return 20;
  return 0;
}

/** Returns the highest-priority role held by the user. */
async function resolveTopRole(supabaseAdmin: any, userId: string): Promise<Role> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = new Set<string>((data ?? []).map((r: any) => r.role));
  if (roles.has("admin")) return "admin";
  if (roles.has("jasper_ai")) return "jasper_ai";
  if (roles.has("developer")) return "developer";
  return "user";
}

export const getMyAiQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const role = await resolveTopRole(supabaseAdmin, context.userId);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_premium, premium_expires_at")
      .eq("id", context.userId)
      .maybeSingle();
    const isPremium = Boolean(profile?.is_premium) ||
      (profile?.premium_expires_at ? new Date(profile.premium_expires_at).getTime() > Date.now() : false);

    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await supabaseAdmin
      .from("ai_image_usage")
      .select("count")
      .eq("user_id", context.userId)
      .eq("used_on", today)
      .maybeSingle();

    const quota = quotaForRole(role, isPremium);
    const used = usage?.count ?? 0;
    return {
      role,
      isPremium,
      quota: quota === Infinity ? null : quota,
      unlimited: quota === Infinity,
      used,
      remaining: quota === Infinity ? null : Math.max(0, quota - used),
    };
  });

/** Internal: enforce + increment usage. Throws if over quota. */
export async function consumeAiQuota(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const role = await resolveTopRole(supabaseAdmin, userId);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_premium, premium_expires_at")
    .eq("id", userId)
    .maybeSingle();
  const isPremium = Boolean(profile?.is_premium) ||
    (profile?.premium_expires_at ? new Date(profile.premium_expires_at).getTime() > Date.now() : false);
  const quota = quotaForRole(role, isPremium);
  if (quota === 0) throw new Error("AI_QUOTA_NONE");

  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabaseAdmin
    .from("ai_image_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("used_on", today)
    .maybeSingle();
  const current = existing?.count ?? 0;
  if (quota !== Infinity && current >= quota) throw new Error("AI_QUOTA_EXCEEDED");

  const { error } = await supabaseAdmin
    .from("ai_image_usage")
    .upsert(
      { user_id: userId, used_on: today, count: current + 1, updated_at: new Date().toISOString() },
      { onConflict: "user_id,used_on" },
    );
  if (error) throw new Error(error.message);
  return { role, isPremium, quota: quota === Infinity ? null : quota, used: current + 1 };
}
