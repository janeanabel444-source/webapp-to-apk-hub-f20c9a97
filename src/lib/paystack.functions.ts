import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PREMIUM_PRICE_KOBO = 500000; // ₦5,000
export const PREMIUM_CURRENCY = "NGN";

/**
 * Initialize a Paystack transaction. Returns an authorization_url
 * the frontend redirects the user to.
 */
export const initPremiumPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { callbackUrl: string }) =>
    z.object({ callbackUrl: z.string().url() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Payments are not configured.");

    const email = context.claims?.email as string | undefined;
    if (!email) throw new Error("No email on account.");

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: PREMIUM_PRICE_KOBO,
        currency: PREMIUM_CURRENCY,
        callback_url: data.callbackUrl,
        metadata: { user_id: context.userId, purpose: "nova_premium" },
      }),
    });

    const body = (await res.json()) as {
      status: boolean;
      message: string;
      data?: { authorization_url: string; access_code: string; reference: string };
    };
    if (!res.ok || !body.status || !body.data) {
      throw new Error(body.message || "Paystack initialization failed");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").insert({
      user_id: context.userId,
      reference: body.data.reference,
      amount_kobo: PREMIUM_PRICE_KOBO,
      currency: PREMIUM_CURRENCY,
      status: "pending",
    });

    return {
      authorizationUrl: body.data.authorization_url,
      reference: body.data.reference,
    };
  });

/**
 * Verify a transaction after the user is redirected back from Paystack.
 * Idempotent — safe to call multiple times. Upgrades the profile on success.
 */
export const verifyPremiumPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) =>
    z.object({ reference: z.string().min(4) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Payments are not configured.");

    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    const body = (await res.json()) as {
      status: boolean;
      message: string;
      data?: { status: string; amount: number; currency: string; paid_at: string; metadata?: any };
    };
    if (!res.ok || !body.status || !body.data) {
      throw new Error(body.message || "Verification failed");
    }

    const success = body.data.status === "success";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("payments")
      .update({
        status: body.data.status,
        paid_at: success ? body.data.paid_at : null,
        raw: body.data as any,
      })
      .eq("reference", data.reference)
      .eq("user_id", context.userId);

    if (success) {
      await supabaseAdmin
        .from("profiles")
        .update({ is_premium: true, premium_since: new Date().toISOString() })
        .eq("id", context.userId);
    }

    return { success, status: body.data.status };
  });
