-- Os assets publicados são legíveis apenas por membros do negócio. Staging é
-- temporário e legível somente pelo usuário que fez o upload.
DROP POLICY IF EXISTS "business_logos_images_read" ON storage.objects;
CREATE POLICY "business_logos_images_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'business-logos'
  AND public.business_logos_image_business_id(name) IS NOT NULL
  AND public.is_business_member(public.business_logos_image_business_id(name))
);

DROP POLICY IF EXISTS "visual_assets_images_read" ON storage.objects;
CREATE POLICY "visual_assets_images_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'business-logos'
  AND public.business_visual_asset_business_id(name) IS NOT NULL
  AND (
    (
      split_part(name, '/', 2) <> 'staging'
      AND public.is_business_member(public.business_visual_asset_business_id(name))
    )
    OR (
      split_part(name, '/', 2) = 'staging'
      AND split_part(name, '/', 3) = auth.uid()::text
      AND public.has_business_permission(
        public.business_visual_asset_business_id(name),
        'manage_appearance'
      )
    )
  )
);
