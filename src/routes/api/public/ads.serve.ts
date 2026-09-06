import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createAdEventToken } from "@/lib/ad-sdk.server";

const inputSchema = z.object({
  app_id: z.string().uuid(),
  placement: z.string().trim().min(1).max(50).default("native"),
  format: z.enum(["card", "banner", "landscape", "video"]).optional(),
});

export const Route = createFileRoute("/api/public/ads/serve")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = inputSchema.safeParse({
          app_id: url.searchParams.get("app_id"),
          placement: url.searchParams.get("placement") || "native",
          format: url.searchParams.get("format") || undefined,
        });
        if (!parsed.success) return Response.json({ error: "Invalid ad request" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: publisher } = await supabaseAdmin
          .from("apps")
          .select("id")
          .eq("id", parsed.data.app_id)
          .eq("is_published", true)
          .in("status", ["live", "approved"])
          .maybeSingle();
        if (!publisher) return Response.json({ error: "Unknown publisher app" }, { status: 404 });

        const { data: campaigns } = await supabaseAdmin
          .from("ad_campaigns")
          .select("id, format, spent_kobo, total_budget_kobo, app:apps(id, slug, name, icon_url, short_description, screenshots, promo_video_path)")
          .eq("status", "active")
          .limit(30);
        const eligible = (campaigns ?? []).filter((campaign: any) => {
          const hasBudget = campaign.spent_kobo < campaign.total_budget_kobo;
          const formatMatches = !parsed.data.format || parsed.data.format === "video"
            ? !parsed.data.format || campaign.format === "video"
            : campaign.format === "screenshot";
          return hasBudget && formatMatches && campaign.app?.id !== publisher.id;
        });
        if (!eligible.length) return new Response(null, { status: 204 });

        const campaign = eligible[Math.floor(Math.random() * eligible.length)] as any;
        let mediaUrl: string | null = campaign.app.screenshots?.[0] ?? null;
        if (campaign.format === "video" && campaign.app.promo_video_path) {
          const { data } = await supabaseAdmin.storage.from("app-videos").createSignedUrl(campaign.app.promo_video_path, 15 * 60);
          mediaUrl = data?.signedUrl ?? null;
        }
        const token = createAdEventToken(campaign.id, publisher.id, parsed.data.placement);
        await supabaseAdmin.from("ad_impressions").insert({
          campaign_id: campaign.id,
          user_id: null,
          placement: parsed.data.placement,
        });

        return Response.json({
          sponsored: true,
          campaign_id: campaign.id,
          event_token: token,
          format: campaign.format === "video" ? "video" : (parsed.data.format ?? "card"),
          close_after_seconds: campaign.format === "video" ? 5 : 0,
          title: campaign.app.name,
          description: campaign.app.short_description,
          icon_url: campaign.app.icon_url,
          media_url: mediaUrl,
          click_url: `${url.origin}/ad/${campaign.id}`,
        }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});