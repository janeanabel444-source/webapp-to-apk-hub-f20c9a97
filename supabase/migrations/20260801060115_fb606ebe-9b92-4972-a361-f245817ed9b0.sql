
DROP POLICY IF EXISTS "app-files published read" ON storage.objects;
DROP FUNCTION IF EXISTS public.storage_object_is_public_app_file(text);

CREATE OR REPLACE FUNCTION private.storage_object_is_public_app_file(object_name text)
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

REVOKE ALL ON FUNCTION private.storage_object_is_public_app_file(text) FROM PUBLIC;

CREATE POLICY "app-files published read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'app-files'
  AND private.storage_object_is_public_app_file(name)
);
