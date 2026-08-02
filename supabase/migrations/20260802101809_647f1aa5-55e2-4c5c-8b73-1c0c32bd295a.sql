ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

CREATE INDEX IF NOT EXISTS apps_share_token_idx ON public.apps (share_token);
CREATE INDEX IF NOT EXISTS apps_status_idx ON public.apps (status);