DROP POLICY IF EXISTS "collection_apps_read" ON public.collection_apps;
CREATE POLICY "collection_apps_read" ON public.collection_apps FOR SELECT TO anon, authenticated
USING (
  EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.is_published = true)
  AND EXISTS (SELECT 1 FROM public.apps a WHERE a.id = app_id AND a.is_published = true AND a.status = 'live')
);