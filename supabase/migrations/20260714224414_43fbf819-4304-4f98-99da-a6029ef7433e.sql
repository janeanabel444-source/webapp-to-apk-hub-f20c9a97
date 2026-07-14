
ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS feature_banner_url text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS developer_name text,
  ADD COLUMN IF NOT EXISTS developer_email text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS privacy_policy_url text,
  ADD COLUMN IF NOT EXISTS min_android_version text,
  ADD COLUMN IF NOT EXISTS target_android_version text,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS content_rating text,
  ADD COLUMN IF NOT EXISTS license text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS price_kobo integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;

-- Grant the new safe columns to public reads (file_path/developer_email stay hidden from anon)
GRANT SELECT (
  id, slug, name, tagline, short_description, description, category, subcategory,
  platform, icon_url, feature_banner_url, screenshots, tags,
  app_url, website_url, privacy_policy_url,
  package_name, version, version_code, apk_size, permissions,
  min_android_version, target_android_version, languages,
  content_rating, license, price_kobo,
  install_count, rating_avg, rating_count,
  is_published, status, last_updated_at, latest_release_notes,
  created_at, updated_at, developer_id, developer_name
) ON public.apps TO anon;
GRANT SELECT (
  id, slug, name, tagline, short_description, description, category, subcategory,
  platform, icon_url, feature_banner_url, screenshots, tags,
  app_url, website_url, privacy_policy_url,
  package_name, version, version_code, apk_size, permissions,
  min_android_version, target_android_version, languages,
  content_rating, license, price_kobo,
  install_count, rating_avg, rating_count,
  is_published, status, last_updated_at, latest_release_notes,
  created_at, updated_at, developer_id, developer_name, developer_email,
  is_draft, file_path
) ON public.apps TO authenticated;

-- Drafts are private to their developer
DROP POLICY IF EXISTS "Drafts are private to developer" ON public.apps;
CREATE POLICY "Drafts are private to developer" ON public.apps
  FOR SELECT TO authenticated
  USING (
    (is_draft = false)
    OR (developer_id = auth.uid())
  );
