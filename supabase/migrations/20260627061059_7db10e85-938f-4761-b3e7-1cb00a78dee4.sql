
-- 1) Profiles: drop blanket policy, revoke direct column reads, expose via view
DROP POLICY IF EXISTS profiles_public_safe_read ON public.profiles;

REVOKE SELECT (id, display_name, avatar_url, created_at, is_premium, premium_since, premium_expires_at)
  ON public.profiles FROM anon, authenticated;

-- Owner can still read their own row (policy profiles_self_read already exists);
-- re-grant only the owner-visible columns to authenticated for that policy to work.
GRANT SELECT (id, display_name, avatar_url, created_at, is_premium, premium_since, premium_expires_at)
  ON public.profiles TO authenticated;

-- Public-safe view exposing only non-sensitive columns
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
  WITH (security_invoker = false) AS
  SELECT id, display_name, avatar_url, created_at
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2) Reviews: remove developer broad UPDATE policy. The reviews_restrict_developer_updates
-- trigger remains as defense-in-depth if a future policy is added.
DROP POLICY IF EXISTS reviews_developer_reply_update ON public.reviews;

-- 3) SECURITY DEFINER functions: revoke EXECUTE from anon/authenticated.
-- Drop the public wrapper for is_user_premium; server code uses private.is_user_premium.
DROP FUNCTION IF EXISTS public.is_user_premium(uuid);

-- Trigger functions don't need direct EXECUTE by client roles.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_app_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_install_count() FROM PUBLIC, anon, authenticated;
