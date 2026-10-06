-- Visual-editor media: published images and per-user staging objects in the private bucket.
CREATE OR REPLACE FUNCTION public.business_visual_asset_business_id(_name text)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN _name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(logo/[^/]+|background/[^/]+|service/[^/]+|staging/[0-9a-f-]{36}/[^/]+/[^/]+)\.(png|jpe?g|webp)$'
    THEN split_part(_name, '/', 1)::uuid END;
$$;
REVOKE ALL ON FUNCTION public.business_visual_asset_business_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_visual_asset_business_id(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "visual_assets_appearance_insert" ON storage.objects;
DROP POLICY IF EXISTS "visual_assets_appearance_update" ON storage.objects;
DROP POLICY IF EXISTS "visual_assets_appearance_delete" ON storage.objects;

CREATE POLICY "visual_assets_appearance_insert" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'business-logos'
  AND public.has_business_permission(public.business_visual_asset_business_id(name), 'manage_appearance')
);
CREATE POLICY "visual_assets_appearance_update" ON storage.objects
FOR UPDATE TO authenticated USING (
  bucket_id = 'business-logos'
  AND public.has_business_permission(public.business_visual_asset_business_id(name), 'manage_appearance')
) WITH CHECK (
  bucket_id = 'business-logos'
  AND public.has_business_permission(public.business_visual_asset_business_id(name), 'manage_appearance')
);
CREATE POLICY "visual_assets_appearance_delete" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'business-logos'
  AND public.has_business_permission(public.business_visual_asset_business_id(name), 'manage_appearance')
);
