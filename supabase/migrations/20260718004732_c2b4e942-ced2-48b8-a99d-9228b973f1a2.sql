
DROP POLICY IF EXISTS "authenticated_inserts_impressions" ON public.ad_impressions;
CREATE POLICY "authenticated_inserts_impressions"
  ON public.ad_impressions FOR INSERT TO authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.ad_campaigns c WHERE c.id = campaign_id AND c.status = 'active')
  );

DROP POLICY IF EXISTS "authenticated_inserts_clicks" ON public.ad_clicks;
CREATE POLICY "authenticated_inserts_clicks"
  ON public.ad_clicks FOR INSERT TO authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.ad_campaigns c WHERE c.id = campaign_id AND c.status = 'active')
  );
