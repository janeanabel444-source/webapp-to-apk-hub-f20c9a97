import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Per-app stats for the owning developer: views, downloads, installs, ads. */
export const getMyAppAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ appId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: app } = await context.supabase
      .from("apps")
      .select("id, name, developer_id, download_count, install_count, rating_avg, rating_count")
      .eq("id", data.appId)
      .maybeSingle();
    if (!app || app.developer_id !== context.userId) throw new Error("App not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 86400_000);
    const [{ count: totalViews }, { data: recent }, { data: campaigns }] = await Promise.all([
      supabaseAdmin.from("app_views").select("id", { count: "exact", head: true }).eq("app_id", app.id),
      supabaseAdmin.from("app_views").select("created_at").eq("app_id", app.id).gte("created_at", since.toISOString()).limit(10000),
      supabaseAdmin.from("ad_campaigns")
        .select("id, name, status, format, spent_kobo, total_budget_kobo, impressions_count, views_count, clicks_count, downloads_count, created_at")
        .eq("app_id", app.id).order("created_at", { ascending: false }),
    ]);

    const days: { date: string; views: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      days.push({ date: d, views: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.date, i]));
    for (const r of recent ?? []) {
      const i = idx.get(r.created_at.slice(0, 10));
      if (i !== undefined) days[i].views++;
    }
    const c = campaigns ?? [];
    const sum = (k: "spent_kobo" | "impressions_count" | "clicks_count" | "downloads_count" | "views_count") =>
      c.reduce((a, x) => a + (x[k] ?? 0), 0);

    return {
      name: app.name,
      totals: {
        views: totalViews ?? 0,
        downloads: app.download_count ?? 0,
        installs: app.install_count ?? 0,
        rating: Number(app.rating_avg ?? 0),
        ratingCount: app.rating_count ?? 0,
      },
      ads: {
        spentKobo: sum("spent_kobo"),
        impressions: sum("impressions_count"),
        adViews: sum("views_count"),
        clicks: sum("clicks_count"),
        downloads: sum("downloads_count"),
      },
      days,
      campaigns: c,
    };
  });
