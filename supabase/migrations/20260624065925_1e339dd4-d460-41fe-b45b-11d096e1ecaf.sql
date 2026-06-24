
-- 1. Private schema for SECURITY DEFINER helpers (not exposed via PostgREST)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

-- 2. Drop policies that reference the public security-definer functions
DROP POLICY IF EXISTS apps_dev_delete ON public.apps;
DROP POLICY IF EXISTS apps_dev_update ON public.apps;
DROP POLICY IF EXISTS apps_public_read ON public.apps;
DROP POLICY IF EXISTS "Users can delete their own AI images" ON public.ai_images;
DROP POLICY IF EXISTS "Premium users can insert their own AI images" ON public.ai_images;
DROP POLICY IF EXISTS "Premium users can view all AI images" ON public.ai_images;

-- 3. Drop public SECURITY DEFINER functions
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_user_premium(uuid);

-- 4. Recreate the helpers in the private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION private.is_user_premium(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND (is_premium = true OR (premium_expires_at IS NOT NULL AND premium_expires_at > now()))
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_user_premium(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_user_premium(uuid) TO authenticated, service_role;

-- 5. Public SECURITY INVOKER wrapper kept only so app code can still RPC is_user_premium
CREATE OR REPLACE FUNCTION public.is_user_premium(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.is_user_premium(_user_id) $$;
REVOKE ALL ON FUNCTION public.is_user_premium(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_premium(uuid) TO authenticated, service_role;

-- 6. Recreate previously-dropped policies, now pointing at private.*
CREATE POLICY apps_dev_delete ON public.apps FOR DELETE TO authenticated
  USING ((developer_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY apps_dev_update ON public.apps FOR UPDATE TO authenticated
  USING ((developer_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK ((developer_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY apps_public_read ON public.apps FOR SELECT TO public
  USING ((is_published = true) OR (developer_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Premium users can view all AI images" ON public.ai_images FOR SELECT TO authenticated
  USING (private.is_user_premium(auth.uid()));

CREATE POLICY "Premium users can insert their own AI images" ON public.ai_images FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND private.is_user_premium(auth.uid()));

CREATE POLICY "Users can delete their own AI images" ON public.ai_images FOR DELETE TO authenticated
  USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'));

-- 7. profiles: restrict premium columns from public reads via column-level grants
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, display_name, avatar_url, created_at) ON public.profiles TO anon, authenticated;
-- Owner reads premium fields server-side via supabaseAdmin (bypasses RLS + grants)

-- 8. promo_codes: admin-only manage policy + grants (was inaccessible/unguarded)
CREATE POLICY promo_codes_admin_manage ON public.promo_codes FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;

-- 9. Storage RLS for the private ai-images bucket (path layout: <user_id>/<file>.png)
DROP POLICY IF EXISTS "ai_images_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "ai_images_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "ai_images_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "ai_images_owner_delete" ON storage.objects;

CREATE POLICY "ai_images_owner_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ai-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "ai_images_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ai-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "ai_images_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ai-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'ai-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "ai_images_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ai-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 10. reviews: prevent developers from editing review body/rating/user_id
DROP POLICY IF EXISTS reviews_self_update ON public.reviews;
CREATE POLICY reviews_self_update ON public.reviews FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid())
    OR (EXISTS (SELECT 1 FROM public.apps a WHERE a.id = reviews.app_id AND a.developer_id = auth.uid()))
  )
  WITH CHECK (
    (user_id = auth.uid())
    OR (EXISTS (SELECT 1 FROM public.apps a WHERE a.id = reviews.app_id AND a.developer_id = auth.uid()))
  );

CREATE OR REPLACE FUNCTION public.reviews_restrict_developer_updates()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF OLD.user_id <> auth.uid() THEN
    IF NEW.rating IS DISTINCT FROM OLD.rating
       OR NEW.body IS DISTINCT FROM OLD.body
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.app_id IS DISTINCT FROM OLD.app_id THEN
      RAISE EXCEPTION 'Developers can only edit reply fields on reviews not authored by them';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_restrict_developer_updates_trg ON public.reviews;
CREATE TRIGGER reviews_restrict_developer_updates_trg
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_restrict_developer_updates();
