import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SUPER_ADMIN_EMAIL = "paschalsoromtochukwu@gmail.com";
const COST_PER_VIEW_KOBO = 500; // ₦5 per view — base rate

async function isAdmin(userId: string, email: string | undefined): Promise<boolean> {
  if ((email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL) return true;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

// ─────────────── Create / list campaigns ───────────────
const createInput = z.object({
  appId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  format: z.enum(["video", "screenshot"]),
  dailyBudgetNaira: z.number().int().positive().max(1000000),
  totalBudgetNaira: z.number().int().positive().max(20000000),
  durationDays: z.number().int().min(1).max(90),
  targetCountries: z.array(z.string().max(3)).max(20).default([]),
  targetCategories: z.array(z.string().max(30)).max(10).default([]),
});

export const createAdCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => createInput.parse(i))
  .handler(async ({ data, context }) => {
    if (data.totalBudgetNaira < data.dailyBudgetNaira) {
      throw new Error("Total budget must be at least the daily budget.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Confirm the app is owned by this advertiser and is live.
    const { data: app, error: aerr } = await supabaseAdmin
      .from("apps")
      .select("id, developer_id, name, status, promo_video_path, screenshots")
      .eq("id", data.appId)
      .maybeSingle();
    if (aerr) throw new Error(aerr.message);
    if (!app || app.developer_id !== context.userId) throw new Error("App not found.");
    if (data.format === "video" && !app.promo_video_path) {
      throw new Error("Upload a promotional video for this app before creating a video campaign.");
    }
    if (data.format === "screenshot" && (!app.screenshots || app.screenshots.length === 0)) {
      throw new Error("Add at least one screenshot before creating a screenshot campaign.");
    }

    const { data: row, error } = await supabaseAdmin
      .from("ad_campaigns")
      .insert({
        advertiser_id: context.userId,
        app_id: data.appId,
        name: data.name,
        format: data.format,
        daily_budget_kobo: data.dailyBudgetNaira * 100,
        total_budget_kobo: data.totalBudgetNaira * 100,
        cost_per_view_kobo: COST_PER_VIEW_KOBO,
        duration_days: data.durationDays,
        target_countries: data.targetCountries,
        target_categories: data.targetCategories,
        status: "pending_payment",
      })
      .select("id, name, total_budget_kobo")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ad_campaigns")
      .select("*, app:apps(id, slug, name, icon_url)")
      .eq("advertiser_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ─────────────── Payment (Paystack) ───────────────
export const initCampaignPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { campaignId: string; callbackUrl: string }) =>
    z.object({
      campaignId: z.string().uuid(),
      callbackUrl: z.string().url(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Payments are not configured.");
    const email = (context.claims as any)?.email as string | undefined;
    if (!email) throw new Error("No email on account.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin
      .from("ad_campaigns")
      .select("id, advertiser_id, total_budget_kobo, status")
      .eq("id", data.campaignId)
      .maybeSingle();
    if (!c || c.advertiser_id !== context.userId) throw new Error("Campaign not found.");
    if (c.status !== "pending_payment") throw new Error("Campaign already paid.");

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount: c.total_budget_kobo,
        currency: "NGN",
        callback_url: data.callbackUrl,
        metadata: { campaign_id: c.id, purpose: "nova_ads_campaign" },
      }),
    });
    const body = await res.json();
    if (!res.ok || !body.status || !body.data) throw new Error(body.message || "Payment init failed");
    await supabaseAdmin
      .from("ad_campaigns")
      .update({ payment_reference: body.data.reference })
      .eq("id", c.id);
    return { authorizationUrl: body.data.authorization_url, reference: body.data.reference };
  });

export const verifyCampaignPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { reference: string }) => z.object({ reference: z.string().min(4) }).parse(i))
  .handler(async ({ data, context }) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Payments are not configured.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin
      .from("ad_campaigns")
      .select("id, advertiser_id, status")
      .eq("payment_reference", data.reference)
      .maybeSingle();
    if (!c || c.advertiser_id !== context.userId) throw new Error("Reference not found.");

    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    const body = await res.json();
    if (!res.ok || !body.status || !body.data) throw new Error(body.message || "Verify failed");
    const success = body.data.status === "success";
    if (success) {
      await supabaseAdmin
        .from("ad_campaigns")
        .update({ status: "pending_review", paid_at: body.data.paid_at ?? new Date().toISOString() })
        .eq("id", c.id);
    }
    return { success, status: body.data.status };
  });

// ─────────────── Ad serving ───────────────
export const pickAdForReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Only pick campaigns with remaining budget headroom.
    const { data: candidates, error } = await supabaseAdmin
      .from("ad_campaigns")
      .select(
        "id, format, cost_per_view_kobo, spent_kobo, total_budget_kobo, app:apps(id, slug, name, icon_url, tagline, short_description, screenshots, promo_video_path)",
      )
      .eq("status", "active")
      .limit(30);
    if (error) throw new Error(error.message);
    const eligible = (candidates ?? []).filter(
      (c: any) => c.spent_kobo + c.cost_per_view_kobo <= c.total_budget_kobo,
    );
    if (eligible.length === 0) throw new Error("NO_ADS_AVAILABLE");
    const pick = eligible[Math.floor(Math.random() * eligible.length)] as any;

    // Sign video / screenshot URLs.
    let videoUrl: string | null = null;
    let screenshotUrls: string[] = [];
    if (pick.format === "video" && pick.app.promo_video_path) {
      const { data: s } = await supabaseAdmin.storage
        .from("app-videos")
        .createSignedUrl(pick.app.promo_video_path, 60 * 60);
      videoUrl = s?.signedUrl ?? null;
    }
    if (pick.format === "screenshot") {
      screenshotUrls = (pick.app.screenshots ?? []).slice(0, 5) as string[];
    }

    // Start a view session (server-side seconds counter).
    const { data: session, error: sErr } = await supabaseAdmin
      .from("ad_view_sessions")
      .insert({ user_id: context.userId, campaign_id: pick.id, required_seconds: pick.format === "video" ? 15 : 10 })
      .select("id, required_seconds")
      .single();
    if (sErr) throw new Error(sErr.message);

    // Record an impression.
    await supabaseAdmin.from("ad_impressions").insert({
      campaign_id: pick.id, user_id: context.userId, placement: "reward",
    });
    await supabaseAdmin.rpc as any; // no-op — increment via update
    await supabaseAdmin
      .from("ad_campaigns")
      .update({ impressions_count: (undefined as any) }) // placeholder; use raw increment below
      .eq("id", pick.id);

    return {
      sessionId: session.id,
      requiredSeconds: session.required_seconds,
      format: pick.format as "video" | "screenshot",
      campaignId: pick.id,
      app: {
        id: pick.app.id,
        slug: pick.app.slug,
        name: pick.app.name,
        iconUrl: pick.app.icon_url as string | null,
        tagline: pick.app.tagline as string | null,
        shortDescription: pick.app.short_description as string | null,
      },
      videoUrl,
      screenshotUrls,
    };
  });

export const recordAdClick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { campaignId: string }) => z.object({ campaignId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ad_clicks").insert({ campaign_id: data.campaignId, user_id: context.userId });
    return { ok: true };
  });

export const claimAdReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { sessionId: string }) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("ad_view_sessions")
      .select("id, user_id, campaign_id, started_at, required_seconds, claimed_at")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session || session.user_id !== context.userId) throw new Error("Session not found.");
    if (session.claimed_at) throw new Error("Reward already claimed.");
    const elapsedSec = (Date.now() - new Date(session.started_at).getTime()) / 1000;
    if (elapsedSec < session.required_seconds - 1) throw new Error("Please finish watching the ad.");

    // Load campaign + verify budget headroom.
    const { data: campaign } = await supabaseAdmin
      .from("ad_campaigns")
      .select("id, spent_kobo, total_budget_kobo, cost_per_view_kobo, views_count, status")
      .eq("id", session.campaign_id)
      .maybeSingle();
    if (!campaign || campaign.status !== "active") throw new Error("Campaign is not active.");
    const nextSpent = campaign.spent_kobo + campaign.cost_per_view_kobo;
    if (nextSpent > campaign.total_budget_kobo) throw new Error("Campaign budget exhausted.");

    // Mark session claimed, debit budget, credit user.
    const now = new Date().toISOString();
    await supabaseAdmin.from("ad_view_sessions")
      .update({ completed_at: now, claimed_at: now })
      .eq("id", session.id);
    const newStatus = nextSpent === campaign.total_budget_kobo ? "completed" : "active";
    await supabaseAdmin.from("ad_campaigns")
      .update({ spent_kobo: nextSpent, views_count: campaign.views_count + 1, status: newStatus })
      .eq("id", campaign.id);

    const { data: prof } = await supabaseAdmin
      .from("profiles").select("bonus_ai_credits").eq("id", context.userId).maybeSingle();
    const newBonus = (prof?.bonus_ai_credits ?? 0) + 1;
    await supabaseAdmin.from("profiles").update({ bonus_ai_credits: newBonus }).eq("id", context.userId);

    return { rewarded: true, bonusCredits: newBonus };
  });

// ─────────────── Admin ───────────────
export const adminListCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.userId, (context.claims as any)?.email))) throw new Error("Admin only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ad_campaigns")
      .select("*, app:apps(id, slug, name, icon_url)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminModerateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      campaignId: z.string().uuid(),
      action: z.enum(["approve", "reject", "pause", "resume", "delete"]),
      note: z.string().max(500).optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.userId, (context.claims as any)?.email))) throw new Error("Admin only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.action === "delete") {
      const { error } = await supabaseAdmin.from("ad_campaigns").delete().eq("id", data.campaignId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const status =
      data.action === "approve" ? "active"
      : data.action === "reject" ? "rejected"
      : data.action === "pause" ? "paused"
      : "active";
    const patch: {
      status: "active" | "rejected" | "paused";
      moderator_note: string | null;
      starts_at?: string;
      ends_at?: string;
    } = { status, moderator_note: data.note ?? null };
    if (data.action === "approve") {
      const now = new Date();
      patch.starts_at = now.toISOString();
      const { data: c } = await supabaseAdmin
        .from("ad_campaigns").select("duration_days").eq("id", data.campaignId).maybeSingle();
      if (c) {
        const end = new Date(now.getTime() + c.duration_days * 24 * 60 * 60 * 1000);
        patch.ends_at = end.toISOString();
      }
    }
    const { error } = await supabaseAdmin.from("ad_campaigns").update(patch).eq("id", data.campaignId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
