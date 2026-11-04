-- Leitura das mídias visuais pelo cliente. O SELECT atual (business_logos_images_read,
-- 20260924064615) cobre apenas <business_id>/logo-* e <business_id>/services/*, e as
-- políticas de escrita de 20261002153000 criaram <business_id>/background/* sem
-- nenhum SELECT correspondente — o createSignedUrl da capa no navegador falhava com
-- 400 e a prévia do editor de aparência caía no fallback de cor sólida.
-- O bucket continua privado; a política só permite assinar objetos já caminhados
-- num business_id válido (mesma postura de leitura das demais imagens de marca).
DROP POLICY IF EXISTS "visual_assets_images_read" ON storage.objects;

CREATE POLICY "visual_assets_images_read" ON storage.objects
FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'business-logos'
  AND public.business_visual_asset_business_id(name) IS NOT NULL
);
