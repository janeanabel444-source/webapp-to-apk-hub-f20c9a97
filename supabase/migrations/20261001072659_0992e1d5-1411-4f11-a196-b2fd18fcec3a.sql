DROP POLICY IF EXISTS "app-videos public read" ON storage.objects;
DROP POLICY IF EXISTS "app-videos owner read" ON storage.objects;
CREATE POLICY "app-videos owner read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'app-videos' AND (storage.foldername(name))[1] = auth.uid()::text);