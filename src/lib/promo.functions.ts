import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Redeem a promo code for the signed-in user.
 * - 'premium' grants permanent premium
 * - 'trial' extends premium_expires_at by trial_days
 * Each code can only be redeemed once per user.
 */
export const redeemPromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) =>
    z.object({ code: z.string().trim().min(2).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const code = data.code.toUpperCase().replace(/\s+/g, " ").trim();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: promo, error: pErr } = await supabaseAdmin
      .from("promo_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!promo || !promo.active) throw new Error("Invalid promo code");
    if (promo.max_uses != null && promo.uses >= promo.max_uses) {
      throw new Error("Promo code is no longer available");
    }

    // Prevent re-use by same user
    const { data: existing } = await supabaseAdmin
      .from("promo_redemptions")
      .select("id")
      .eq("user_id", context.userId)
      .eq("code", code)
      .maybeSingle();
    if (existing) throw new Error("You've already redeemed this code");

    // Record redemption (unique constraint also protects against races)
    const { error: rErr } = await supabaseAdmin
      .from("promo_redemptions")
      .insert({ user_id: context.userId, code });
    if (rErr) {
      if (rErr.code === "23505") throw new Error("You've already redeemed this code");
      throw new Error(rErr.message);
    }

    // Update profile
    let granted: "premium" | "trial" = "premium";
    let trialUntil: string | null = null;
    if (promo.grant_type === "premium") {
      const { error: uErr } = await supabaseAdmin
        .from("profiles")
        .update({ is_premium: true, premium_since: new Date().toISOString() })
        .eq("id", context.userId);
      if (uErr) throw new Error(uErr.message);
    } else {
      granted = "trial";
      const days = promo.trial_days ?? 7;
      const { data: current } = await supabaseAdmin
        .from("profiles")
        .select("premium_expires_at")
        .eq("id", context.userId)
        .maybeSingle();
      const base = current?.premium_expires_at
        ? Math.max(new Date(current.premium_expires_at).getTime(), Date.now())
        : Date.now();
      const next = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
      trialUntil = next;
      const { error: uErr } = await supabaseAdmin
        .from("profiles")
        .update({ premium_expires_at: next })
        .eq("id", context.userId);
      if (uErr) throw new Error(uErr.message);
    }

    await supabaseAdmin
      .from("promo_codes")
      .update({ uses: promo.uses + 1 })
      .eq("code", code);

    return { granted, trialUntil };
  });
