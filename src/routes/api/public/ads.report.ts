import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyAdEventToken } from "@/lib/ad-sdk.server";

const reportSchema = z.object({
  campaign_id: z.string().uuid(),
  publisher_app_id: z.string().uuid(),
  placement: z.string().trim().min(1).max(50),
  event_token: z.string().min(20).max(300),
  event: z.enum(["click", "download"]),
});

export const Route = createFileRoute("/api/public/ads/report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = reportSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid report" }, { status: 400 });
        const data = parsed.data;
        if (!verifyAdEventToken(data.event_token, data.campaign_id, data.publisher_app_id, data.placement)) {
          return Response.json({ error: "Invalid or expired event token" }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: campaign } = await supabaseAdmin
          .from("ad_campaigns")
          .select("id, clicks_count, downloads_count, status")
          .eq("id", data.campaign_id)
          .maybeSingle();
        if (!campaign || campaign.status !== "active") return Response.json({ error: "Campaign unavailable" }, { status: 404 });

        if (data.event === "click") {
          await supabaseAdmin.from("ad_clicks").insert({ campaign_id: campaign.id, user_id: null });
          await supabaseAdmin.from("ad_campaigns").update({ clicks_count: campaign.clicks_count + 1 }).eq("id", campaign.id);
        } else {
          await supabaseAdmin.from("ad_campaigns").update({ downloads_count: campaign.downloads_count + 1 }).eq("id", campaign.id);
        }
        return Response.json({ ok: true });
      },
    },
  },
});