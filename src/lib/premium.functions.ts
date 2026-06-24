import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyPremiumStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Premium columns are not readable via the authenticated user client
    // (column-level grants restrict them). Read with the admin client,
    // scoped strictly to the authenticated user's own row.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
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
