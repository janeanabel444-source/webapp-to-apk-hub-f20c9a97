import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) return new Response("Not configured", { status: 500 });

        const raw = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const expected = createHmac("sha512", secret).update(raw).digest("hex");

        const a = Buffer.from(signature, "utf8");
        const b = Buffer.from(expected, "utf8");
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: any;
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        if (event.event === "charge.success" && event.data) {
          const reference: string = event.data.reference;
          const userId: string | undefined = event.data.metadata?.user_id;
          const paidAt: string = event.data.paid_at ?? new Date().toISOString();

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("payments")
            .update({ status: "success", paid_at: paidAt, raw: event.data })
            .eq("reference", reference);

          if (userId) {
            await supabaseAdmin
              .from("profiles")
              .update({ is_premium: true, premium_since: paidAt })
              .eq("id", userId);
          }
        }

        return new Response("ok");
      },
    },
  },
});
