-- Foto de profissional no bucket privado business-logos, em <business_id>/professional/<arquivo>.
-- Leitura: qualquer membro do negócio (dono e profissionais veem as bolhas da Agenda).
-- Escrita: somente o dono, o mesmo critério da tabela professionals (professionals_owner).

CREATE OR REPLACE FUNCTION public.business_professional_photo_business_id(_name text)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN _name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/professional/[^/]+\.(png|jpe?g|webp)$'
    THEN split_part(_name, '/', 1)::uuid END;
$$;
REVOKE ALL ON FUNCTION public.business_professional_photo_business_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_professional_photo_business_id(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "professional_photos_read" ON storage.objects;
DROP POLICY IF EXISTS "professional_photos_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "professional_photos_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "professional_photos_owner_delete" ON storage.objects;

CREATE POLICY "professional_photos_read" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'business-logos'
  AND public.is_business_member(public.business_professional_photo_business_id(name))
);
CREATE POLICY "professional_photos_owner_insert" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'business-logos'
  AND public.owns_business(public.business_professional_photo_business_id(name))
);
CREATE POLICY "professional_photos_owner_update" ON storage.objects
FOR UPDATE TO authenticated USING (
  bucket_id = 'business-logos'
  AND public.owns_business(public.business_professional_photo_business_id(name))
) WITH CHECK (
  bucket_id = 'business-logos'
  AND public.owns_business(public.business_professional_photo_business_id(name))
);
CREATE POLICY "professional_photos_owner_delete" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'business-logos'
  AND public.owns_business(public.business_professional_photo_business_id(name))
);

-- Rollback: DROP das quatro policies acima e
-- DROP FUNCTION IF EXISTS public.business_professional_photo_business_id(text);
