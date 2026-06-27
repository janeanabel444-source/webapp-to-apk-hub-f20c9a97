
-- Recreate view with security_invoker = true so it uses the caller's permissions.
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
  WITH (security_invoker = true) AS
  SELECT id, display_name, avatar_url, created_at
  FROM public.profiles;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Add a SELECT policy on profiles. Column-level grants (id, display_name,
-- avatar_url, created_at only for anon; same + premium fields for the owner
-- via profiles_self_read) ensure premium columns are never exposed publicly.
CREATE POLICY profiles_public_safe_columns ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (true);
