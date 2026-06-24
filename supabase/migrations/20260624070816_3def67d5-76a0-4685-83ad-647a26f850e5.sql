
-- 1. Extend app_role with jasper_ai
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'jasper_ai';

-- 2. Extend apps table
ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS app_url text,
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS screenshots text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.apps
  DROP CONSTRAINT IF EXISTS apps_status_check;
ALTER TABLE public.apps
  ADD CONSTRAINT apps_status_check CHECK (status IN ('pending','approved','live','rejected'));

-- Existing seeded apps stay visible
UPDATE public.apps SET status = 'live' WHERE status = 'pending' AND is_published = true AND developer_id IS NULL;

-- 3. Tighten public read on apps: only live apps for the public
DROP POLICY IF EXISTS apps_public_read ON public.apps;
CREATE POLICY apps_public_read ON public.apps
  FOR SELECT
  USING (
    (is_published = true AND status = 'live')
    OR developer_id = auth.uid()
    OR private.has_role(auth.uid(), 'admin'::app_role)
  );

-- 4. AI image daily usage tracking
CREATE TABLE IF NOT EXISTS public.ai_image_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_on date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, used_on)
);

GRANT SELECT ON public.ai_image_usage TO authenticated;
GRANT ALL ON public.ai_image_usage TO service_role;

ALTER TABLE public.ai_image_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_image_usage_owner_read ON public.ai_image_usage;
CREATE POLICY ai_image_usage_owner_read ON public.ai_image_usage
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 5. Storage policies for developer buckets
-- Public read for app-logos and app-screenshots
DROP POLICY IF EXISTS "app-logos public read" ON storage.objects;
CREATE POLICY "app-logos public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'app-logos');

DROP POLICY IF EXISTS "app-screenshots public read" ON storage.objects;
CREATE POLICY "app-screenshots public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'app-screenshots');

-- Developers can manage their own folder in each bucket
DO $$
DECLARE b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['app-logos','app-screenshots','app-files']
  LOOP
    EXECUTE format($p$
      DROP POLICY IF EXISTS %1$I ON storage.objects;
      CREATE POLICY %1$I ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = %2$L AND (storage.foldername(name))[1] = auth.uid()::text);
    $p$, b || ' owner insert', b);

    EXECUTE format($p$
      DROP POLICY IF EXISTS %1$I ON storage.objects;
      CREATE POLICY %1$I ON storage.objects
        FOR UPDATE TO authenticated
        USING (bucket_id = %2$L AND (storage.foldername(name))[1] = auth.uid()::text)
        WITH CHECK (bucket_id = %2$L AND (storage.foldername(name))[1] = auth.uid()::text);
    $p$, b || ' owner update', b);

    EXECUTE format($p$
      DROP POLICY IF EXISTS %1$I ON storage.objects;
      CREATE POLICY %1$I ON storage.objects
        FOR DELETE TO authenticated
        USING (bucket_id = %2$L AND (storage.foldername(name))[1] = auth.uid()::text);
    $p$, b || ' owner delete', b);
  END LOOP;
END $$;

-- Owner can read own files in private app-files bucket
DROP POLICY IF EXISTS "app-files owner read" ON storage.objects;
CREATE POLICY "app-files owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'app-files' AND (storage.foldername(name))[1] = auth.uid()::text);
