
-- Enforce column-level security so sensitive columns cannot be read via PostgREST

-- profiles: hide is_premium, premium_since, premium_expires_at from anon/authenticated
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, avatar_url, created_at) ON public.profiles TO anon;
GRANT SELECT (id, display_name, avatar_url, created_at) ON public.profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- app_versions: hide file_path (internal storage path) from anon/authenticated
REVOKE SELECT ON public.app_versions FROM anon;
REVOKE SELECT ON public.app_versions FROM authenticated;
GRANT SELECT (id, app_id, version, version_code, release_notes, created_at, package_name, apk_size, permissions, permissions_added, permissions_removed) ON public.app_versions TO anon;
GRANT SELECT (id, app_id, version, version_code, release_notes, created_at, package_name, apk_size, permissions, permissions_added, permissions_removed) ON public.app_versions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_versions TO authenticated;
GRANT ALL ON public.app_versions TO service_role;
