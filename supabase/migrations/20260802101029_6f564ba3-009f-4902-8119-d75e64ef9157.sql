ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS release_channel text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS share_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS integration_method text;

CREATE UNIQUE INDEX IF NOT EXISTS apps_share_token_key ON public.apps (share_token);
CREATE INDEX IF NOT EXISTS apps_release_channel_idx ON public.apps (release_channel);