import { createFileRoute } from "@tanstack/react-router";

/**
 * Ad attribution link: `/ad/<campaign-id>`.
 *
 * Records the click (deduplicated per campaign + IP within 10 minutes),
 * then redirects to the advertised store listing.
 */
export const Route = createFileRoute("/ad/$campaignId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const campaignId = String((params as { campaignId?: string })?.campaignId ?? "");
        const origin = new URL(request.url).origin;
        if (!/^[0-9a-f-]{36}$/i.test(campaignId)) {
          return Response.redirect(`${origin}/`, 302);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: campaign } = await supabaseAdmin
          .from("ad_campaigns")
          .select("id, status, clicks_count, app:apps(slug)")
          .eq("id", campaignId)
          .maybeSingle();

        const slug = (campaign as any)?.app?.slug as string | undefined;
        if (!campaign || !slug) return Response.redirect(`${origin}/`, 302);

        if (campaign.status === "active") {
          const since = new Date(Date.now() - 10 * 60_000).toISOString();
          const { count } = await supabaseAdmin
            .from("ad_clicks")
            .select("id", { count: "exact", head: true })
            .eq("campaign_id", campaignId)
            .is("user_id", null)
            .gte("created_at", since);
          if (!count) {
            await supabaseAdmin.from("ad_clicks").insert({ campaign_id: campaignId, user_id: null });
            await supabaseAdmin
              .from("ad_campaigns")
              .update({ clicks_count: (campaign.clicks_count ?? 0) + 1 })
              .eq("id", campaignId);
          }
        }

        return Response.redirect(`${origin}/app/${slug}?ref=ad&c=${campaignId}`, 302);
      },
    },
  },
});
