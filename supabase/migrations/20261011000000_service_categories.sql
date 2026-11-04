-- Categorias de serviço: aba "Categoria" no painel 2 (dono cadastra a
-- categoria e vincula serviços) e agrupamento colapsável no painel 1.
-- Um serviço pertence a no máximo uma categoria (services.category_id).
CREATE TABLE public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.service_categories(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_categories TO authenticated;
GRANT SELECT ON public.service_categories TO anon;
GRANT ALL ON public.service_categories TO service_role;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_categories_owner_manage" ON public.service_categories
FOR ALL TO authenticated
USING (public.owns_business(business_id))
WITH CHECK (public.owns_business(business_id));

CREATE POLICY "service_categories_member_read" ON public.service_categories
FOR SELECT TO authenticated
USING (public.is_business_member(business_id));

CREATE POLICY "service_categories_public_read" ON public.service_categories
FOR SELECT TO anon
USING (active);

CREATE INDEX service_categories_business_idx ON public.service_categories(business_id);
CREATE INDEX services_category_idx ON public.services(category_id) WHERE category_id IS NOT NULL;
