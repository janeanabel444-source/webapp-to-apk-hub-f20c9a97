ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'paystack' CHECK (payment_provider IN ('niza_hub','paystack'));
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'paystack' CHECK (provider IN ('niza_hub','paystack'));

CREATE TABLE IF NOT EXISTS public.app_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  visitor_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.app_views TO authenticated;
GRANT ALL ON public.app_views TO service_role;
ALTER TABLE public.app_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "App owners and admins can read app views"
  ON public.app_views FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.apps a WHERE a.id = app_id AND (a.developer_id = auth.uid() OR private.is_admin(auth.uid()))));
CREATE POLICY "Visitors can record app views"
  ON public.app_views FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid() OR viewer_id IS NULL);
CREATE INDEX IF NOT EXISTS idx_app_views_app_created ON public.app_views(app_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_views_dedupe ON public.app_views(app_id, visitor_key, created_at DESC);