
-- 1. Add promotional video to apps
ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS promo_video_path TEXT;

-- 2. Bonus AI credits earned from ads
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonus_ai_credits INTEGER NOT NULL DEFAULT 0;

-- 3. Campaigns
CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('video','screenshot')),
  daily_budget_kobo INTEGER NOT NULL CHECK (daily_budget_kobo >= 10000),
  total_budget_kobo INTEGER NOT NULL CHECK (total_budget_kobo >= daily_budget_kobo),
  spent_kobo INTEGER NOT NULL DEFAULT 0,
  cost_per_view_kobo INTEGER NOT NULL DEFAULT 500,
  duration_days INTEGER NOT NULL CHECK (duration_days BETWEEN 1 AND 90),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  target_countries TEXT[] NOT NULL DEFAULT '{}',
  target_categories TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('draft','pending_payment','pending_review','active','paused','rejected','completed')),
  payment_reference TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  moderator_note TEXT,
  impressions_count INTEGER NOT NULL DEFAULT 0,
  views_count INTEGER NOT NULL DEFAULT 0,
  clicks_count INTEGER NOT NULL DEFAULT 0,
  downloads_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_campaigns TO authenticated;
GRANT ALL ON public.ad_campaigns TO service_role;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advertiser_manages_own_campaigns"
  ON public.ad_campaigns FOR ALL TO authenticated
  USING (advertiser_id = auth.uid() OR private.is_admin(auth.uid()))
  WITH CHECK (advertiser_id = auth.uid() OR private.is_admin(auth.uid()));

CREATE POLICY "authenticated_reads_active_campaigns"
  ON public.ad_campaigns FOR SELECT TO authenticated
  USING (status = 'active');

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON public.ad_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_advertiser ON public.ad_campaigns(advertiser_id);

CREATE TRIGGER trg_ad_campaigns_touch BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Ad view sessions (reward integrity)
CREATE TABLE IF NOT EXISTS public.ad_view_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  required_seconds INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ad_view_sessions TO authenticated;
GRANT ALL ON public.ad_view_sessions TO service_role;
ALTER TABLE public.ad_view_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_reads_own_view_sessions"
  ON public.ad_view_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ad_view_sessions_user ON public.ad_view_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_view_sessions_campaign ON public.ad_view_sessions(campaign_id);

-- 5. Impressions
CREATE TABLE IF NOT EXISTS public.ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  placement TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ad_impressions TO authenticated;
GRANT ALL ON public.ad_impressions TO service_role;
ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advertiser_reads_own_impressions"
  ON public.ad_impressions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ad_campaigns c WHERE c.id = campaign_id
                 AND (c.advertiser_id = auth.uid() OR private.is_admin(auth.uid()))));

CREATE POLICY "authenticated_inserts_impressions"
  ON public.ad_impressions FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_campaign ON public.ad_impressions(campaign_id);

-- 6. Clicks
CREATE TABLE IF NOT EXISTS public.ad_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ad_clicks TO authenticated;
GRANT ALL ON public.ad_clicks TO service_role;
ALTER TABLE public.ad_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advertiser_reads_own_clicks"
  ON public.ad_clicks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ad_campaigns c WHERE c.id = campaign_id
                 AND (c.advertiser_id = auth.uid() OR private.is_admin(auth.uid()))));

CREATE POLICY "authenticated_inserts_clicks"
  ON public.ad_clicks FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ad_clicks_campaign ON public.ad_clicks(campaign_id);
