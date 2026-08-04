ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS game_category TEXT,
  ADD COLUMN IF NOT EXISTS game_type TEXT,
  ADD COLUMN IF NOT EXISTS game_engine TEXT,
  ADD COLUMN IF NOT EXISTS contains_ads BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_iap BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_multiplayer BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_account BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_chat BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS online_features BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offline_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS controller_support BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cloud_save BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_policy_source TEXT,
  ADD COLUMN IF NOT EXISTS detected_privacy_url TEXT,
  ADD COLUMN IF NOT EXISTS is_coming_soon BOOLEAN NOT NULL DEFAULT false;

UPDATE public.apps SET content_type = 'game' WHERE category = 'game' AND content_type = 'app';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.pre_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, app_id)
);

GRANT SELECT, INSERT, DELETE ON public.pre_registrations TO authenticated;
GRANT ALL ON public.pre_registrations TO service_role;
ALTER TABLE public.pre_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own pre-registrations"
  ON public.pre_registrations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.moderation_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id UUID REFERENCES public.apps(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.moderation_violations TO authenticated;
GRANT ALL ON public.moderation_violations TO service_role;
ALTER TABLE public.moderation_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Developers view their own violations"
  ON public.moderation_violations FOR SELECT TO authenticated
  USING (auth.uid() = developer_id OR private.has_role(auth.uid(), 'admin'));