
-- 1. New columns on apps
ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS version text NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS latest_release_notes text,
  ADD COLUMN IF NOT EXISTS last_updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Track which version a user installed
ALTER TABLE public.installs
  ADD COLUMN IF NOT EXISTS installed_version text;

-- 3. Semver helper
CREATE OR REPLACE FUNCTION public.semver_to_int_array(v text)
RETURNS int[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT COALESCE(NULLIF(regexp_replace(part, '[^0-9]', '', 'g'), '')::int, 0)
    FROM unnest(string_to_array(COALESCE(v, '0'), '.')) AS part
  )
$$;

-- 4. Version history table
CREATE TABLE IF NOT EXISTS public.app_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  version text NOT NULL,
  release_notes text,
  file_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, version)
);

CREATE INDEX IF NOT EXISTS app_versions_app_id_created_at_idx
  ON public.app_versions (app_id, created_at DESC);

GRANT SELECT ON public.app_versions TO anon, authenticated;
GRANT ALL ON public.app_versions TO service_role;

ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read version history of published apps"
ON public.app_versions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.apps a
    WHERE a.id = app_versions.app_id
      AND a.is_published = true
  )
);

CREATE POLICY "Developers can read their own app history"
ON public.app_versions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.apps a
    WHERE a.id = app_versions.app_id
      AND a.developer_id = auth.uid()
  )
);

-- Writes only via service_role from server functions (no insert/update/delete policies).

-- 5. Backfill: a 1.0.0 history row for every existing app
INSERT INTO public.app_versions (app_id, version, release_notes, file_path, created_at)
SELECT a.id, COALESCE(a.version, '1.0.0'), 'Initial release', a.file_path, a.created_at
FROM public.apps a
ON CONFLICT (app_id, version) DO NOTHING;
