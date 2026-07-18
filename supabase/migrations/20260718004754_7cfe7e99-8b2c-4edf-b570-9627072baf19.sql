
CREATE POLICY "app_videos_owner_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'app-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "app_videos_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'app-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "app_videos_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'app-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "app_videos_authenticated_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'app-videos');
