-- Spec 002 / T007: bucket privado business-logos e políticas por operação e caminho.
--
-- Caminhos usados pelo app:
--   <business_id>/logo-<ts>.<ext>          logo (painel, cliente autenticado)
--   <business_id>/services/<uuid>-<nome>   imagem de serviço (painel, cliente autenticado)
--   <business_id>/panel1-settings.json     preferências (somente servidor com service role)
--
-- O bucket é privado: imagens são entregues por URL assinada. Service role ignora RLS,
-- então o JSON fica acessível apenas às funções de servidor, sem política para clientes.
-- Idempotente e sem apagar objetos existentes.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-logos',
  'business-logos',
  false,
  5242880, -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/json']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Retorna o business_id de um caminho de imagem válido, ou NULL para qualquer outro
-- objeto (inclusive panel1-settings.json). Evita cast de pasta não-UUID para uuid.
CREATE OR REPLACE FUNCTION public.business_logos_image_business_id(_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN _name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(logo-[^/]+|services/[^/]+)\.(png|jpe?g|webp)$'
      THEN split_part(_name, '/', 1)::uuid
  END;
$$;
REVOKE ALL ON FUNCTION public.business_logos_image_business_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_logos_image_business_id(text) TO anon, authenticated, service_role;

-- Políticas antigas (20260907041401): leitura do bucket inteiro, inclusive JSON, e
-- UPDATE sem WITH CHECK.
DROP POLICY IF EXISTS "business_logos_read" ON storage.objects;
DROP POLICY IF EXISTS "business_logos_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "business_logos_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "business_logos_owner_delete" ON storage.objects;

DROP POLICY IF EXISTS "business_logos_images_read" ON storage.objects;
DROP POLICY IF EXISTS "business_logos_images_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "business_logos_images_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "business_logos_images_owner_delete" ON storage.objects;

-- Leitura pública só de imagens: download e criação de URL assinada. Também é o
-- SELECT exigido pelo upsert do dono.
CREATE POLICY "business_logos_images_read" ON storage.objects
FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'business-logos'
  AND public.business_logos_image_business_id(name) IS NOT NULL
);

-- Escrita somente de imagens do próprio negócio. owns_business(NULL) é falso.
CREATE POLICY "business_logos_images_owner_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'business-logos'
  AND public.owns_business(public.business_logos_image_business_id(name))
);

CREATE POLICY "business_logos_images_owner_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'business-logos'
  AND public.owns_business(public.business_logos_image_business_id(name))
)
WITH CHECK (
  bucket_id = 'business-logos'
  AND public.owns_business(public.business_logos_image_business_id(name))
);

CREATE POLICY "business_logos_images_owner_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'business-logos'
  AND public.owns_business(public.business_logos_image_business_id(name))
);
