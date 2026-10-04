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
    const email = context.claims?.email as string | undefined;
    if (!email) throw new Error("No email on account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Niza Hub first, when the user has a linked Niza Hub account.
    const { isHubConfigured, hubInitializePayment } = await import("@/lib/niza-hub.server");
    if (isHubConfigured()) {
      const { data: prof } = await supabaseAdmin
        .from("profiles").select("niza_hub_user_id").eq("id", context.userId).maybeSingle();
      const globalUserId = prof?.niza_hub_user_id ?? null;
      if (globalUserId) {
        const hub = await hubInitializePayment({
          globalUserId,
          productId: "niza_premium",
          amount: PREMIUM_PRICE_KOBO / 100,
          currency: PREMIUM_CURRENCY,
          callbackUrl: data.callbackUrl,
          metadata: { user_id: context.userId, purpose: "niza_premium", email },
        });
        if (hub.ok && hub.data?.authorization_url && hub.data?.reference) {
          await supabaseAdmin.from("payments").insert({
            user_id: context.userId, provider: "niza_hub", reference: hub.data.reference,
            amount_kobo: PREMIUM_PRICE_KOBO, currency: PREMIUM_CURRENCY, status: "pending",
          });
          return { authorizationUrl: hub.data.authorization_url, reference: hub.data.reference };
        }
      }
    }

    // 2) Paystack fallback.
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Payments are not configured.");

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

    await supabaseAdmin.from("payments").insert({
      user_id: context.userId,
      provider: "paystack",
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
    // SECURITY: confirm the reference belongs to the caller before calling Paystack
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ownRow } = await supabaseAdmin
      .from("payments")
      .select("user_id, provider, status")
      .eq("reference", data.reference)
      .maybeSingle();
    if (!ownRow || ownRow.user_id !== context.userId) {
      throw new Error("Payment reference not found for this account");
    }

    if (ownRow.provider === "niza_hub") {
      const { hubVerifyPayment } = await import("@/lib/niza-hub.server");
      const hub = await hubVerifyPayment({ reference: data.reference, productId: "niza_premium" });
      if (!hub.ok) throw new Error("Couldn't verify payment with Niza Hub.");
      const status = hub.data?.status ?? "unknown";
      const ok = !!hub.data?.paid || status === "success" || status === "paid";
      await supabaseAdmin.from("payments")
        .update({ status: ok ? "success" : status, paid_at: ok ? (hub.data?.paid_at ?? new Date().toISOString()) : null, raw: hub.data as any })
        .eq("reference", data.reference).eq("user_id", context.userId);
      if (ok) {
        await supabaseAdmin.from("profiles")
          .update({ is_premium: true, premium_since: new Date().toISOString() }).eq("id", context.userId);
      }
      return { success: ok, status };
    }

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
