ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS niza_hub_user_id text,
  ADD COLUMN IF NOT EXISTS niza_hub_email text,
  ADD COLUMN IF NOT EXISTS niza_hub_connected_at timestamptz;

CREATE TABLE IF NOT EXISTS public.niza_hub_events (
  reference text PRIMARY KEY,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.niza_hub_events TO service_role;
ALTER TABLE public.niza_hub_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.developer_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  app_id uuid,
  status text NOT NULL DEFAULT 'pending',
  snoozed_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS developer_prompts_unique
  ON public.developer_prompts (user_id, kind, COALESCE(app_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.developer_prompts TO authenticated;
GRANT ALL ON public.developer_prompts TO service_role;
ALTER TABLE public.developer_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own developer prompts"
  ON public.developer_prompts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);