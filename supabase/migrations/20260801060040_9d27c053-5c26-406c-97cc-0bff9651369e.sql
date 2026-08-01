
CREATE OR REPLACE FUNCTION public.storage_object_is_public_app_file(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.apps a
    WHERE a.file_path = object_name
      AND a.is_published = true
      AND a.status = 'live'
  ) OR EXISTS (
    SELECT 1 FROM public.app_versions v
    JOIN public.apps a ON a.id = v.app_id
    WHERE v.file_path = object_name
      AND a.is_published = true
      AND a.status = 'live'
  );
$$;

REVOKE ALL ON FUNCTION public.storage_object_is_public_app_file(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_object_is_public_app_file(text) TO authenticated, anon, service_role;

DROP POLICY IF EXISTS "app-files published read" ON storage.objects;
CREATE POLICY "app-files published read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'app-files'
  AND public.storage_object_is_public_app_file(name)
);

DROP POLICY IF EXISTS "app_videos_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "app-videos public read" ON storage.objects;
CREATE POLICY "app-videos public read"
ON storage.objects FOR SELECT TO authenticated, anon
USING (bucket_id = 'app-videos');
