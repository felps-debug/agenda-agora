BEGIN;

-- Do not silently rewrite legacy links. Stop before changing constraints so an
-- operator can inspect and explicitly resolve any cross-business rows first.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.services AS s
    JOIN public.service_categories AS c ON c.id = s.category_id
    WHERE s.business_id <> c.business_id
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce service category tenant scope: cross-business service category links exist';
  END IF;
END;
$$;

ALTER TABLE public.service_categories
  ADD CONSTRAINT service_categories_id_business_id_key UNIQUE (id, business_id);

ALTER TABLE public.services
  DROP CONSTRAINT services_category_id_fkey;

ALTER TABLE public.services
  ADD CONSTRAINT services_category_business_id_fkey
  FOREIGN KEY (category_id, business_id)
  REFERENCES public.service_categories (id, business_id)
  ON DELETE SET NULL (category_id);

COMMIT;
