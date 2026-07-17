
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') $$;
REVOKE EXECUTE ON FUNCTION private.is_admin(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.increment_download(_app_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ UPDATE public.apps SET download_count = download_count + 1 WHERE id = _app_id; $$;
REVOKE EXECUTE ON FUNCTION private.increment_download(uuid) FROM PUBLIC;

-- Repoint policies from public.is_admin to private.is_admin
DROP POLICY IF EXISTS "reports_own_read" ON public.reports;
DROP POLICY IF EXISTS "reports_admin_update" ON public.reports;
DROP POLICY IF EXISTS "collections_public_read" ON public.collections;
DROP POLICY IF EXISTS "collections_admin_write" ON public.collections;
DROP POLICY IF EXISTS "collections_admin_update" ON public.collections;
DROP POLICY IF EXISTS "collections_admin_delete" ON public.collections;
DROP POLICY IF EXISTS "collection_apps_admin_write" ON public.collection_apps;

CREATE POLICY "reports_own_read" ON public.reports FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR private.is_admin(auth.uid()));
CREATE POLICY "reports_admin_update" ON public.reports FOR UPDATE
  TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY "collections_public_read" ON public.collections FOR SELECT
  USING (is_published = true OR private.is_admin(auth.uid()));
CREATE POLICY "collections_admin_write" ON public.collections FOR INSERT
  TO authenticated WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY "collections_admin_update" ON public.collections FOR UPDATE
  TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY "collections_admin_delete" ON public.collections FOR DELETE
  TO authenticated USING (private.is_admin(auth.uid()));
CREATE POLICY "collection_apps_admin_write" ON public.collection_apps FOR ALL
  TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

-- Drop public wrappers now that policies no longer reference them
DROP FUNCTION IF EXISTS public.is_admin(uuid);
DROP FUNCTION IF EXISTS public.increment_download(uuid);
