import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyPremiumStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("is_premium, premium_since, premium_expires_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const expires = data?.premium_expires_at ? new Date(data.premium_expires_at) : null;
    const trialActive = expires ? expires.getTime() > Date.now() : false;
    return {
      isPremium: Boolean(data?.is_premium) || trialActive,
      premiumSince: data?.premium_since ?? null,
      premiumExpiresAt: data?.premium_expires_at ?? null,
      trialActive,
    };
  });
