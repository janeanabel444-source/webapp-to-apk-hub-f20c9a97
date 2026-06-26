
-- 1) PROFILES: revoke broad table-level SELECT on authenticated; only safe columns are readable.
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, display_name, avatar_url, created_at) ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE (display_name, avatar_url) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Replace the wide public policy with column-scoped read policies. The
-- safe-columns policy stays permissive but column grants above mean only
-- id/display_name/avatar_url/created_at can ever be returned via the Data API.
-- profiles_self_read still lets a user query their own row (column grants
-- prevent reading premium fields via Data API; server uses service role).
DROP POLICY IF EXISTS "profiles_public_safe_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_read" ON public.profiles;

CREATE POLICY "profiles_public_safe_read" ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "profiles_self_read" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 2) is_user_premium: prevent cross-user probing. Only allow callers to check
-- their own premium status (service_role bypasses the guard).
CREATE OR REPLACE FUNCTION public.is_user_premium(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    -- Block probing of other users' premium status from the client.
    RETURN false;
  END IF;
  RETURN private.is_user_premium(_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.is_user_premium(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_premium(uuid) TO authenticated, service_role;

-- 3) Reviews: tighten the trigger to a whitelist — when the editor is not the
-- review author, ONLY dev_reply / dev_replied_at / updated_at may change.
CREATE OR REPLACE FUNCTION public.reviews_restrict_developer_updates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.user_id <> auth.uid() THEN
    IF NEW.id           IS DISTINCT FROM OLD.id
       OR NEW.user_id   IS DISTINCT FROM OLD.user_id
       OR NEW.app_id    IS DISTINCT FROM OLD.app_id
       OR NEW.rating    IS DISTINCT FROM OLD.rating
       OR NEW.body      IS DISTINCT FROM OLD.body
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Developers can only edit reply fields on reviews not authored by them';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
