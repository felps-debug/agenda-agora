-- Public booking loads its catalog by slug through server-side Server Functions.
-- The anon client does not need direct enumeration access to catalog tables.
REVOKE ALL ON TABLE public.businesses FROM anon;
REVOKE ALL ON TABLE public.services FROM anon;
REVOKE ALL ON TABLE public.professionals FROM anon;
REVOKE ALL ON TABLE public.service_professionals FROM anon;
REVOKE ALL ON TABLE public.business_hours FROM anon;
REVOKE ALL ON TABLE public.service_categories FROM anon;
REVOKE ALL ON TABLE public.time_blocks FROM anon;

-- businesses/professionals tinham grants de SELECT em colunas individuais;
-- Table-level REVOKE does not remove column-level SELECT grants.
DO $$
DECLARE
  relation_name text;
  column_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['businesses', 'services', 'professionals', 'service_professionals', 'business_hours', 'service_categories', 'time_blocks'] LOOP
    FOR column_name IN
      SELECT a.attname
      FROM pg_attribute a
      WHERE a.attrelid = format('public.%I', relation_name)::regclass
        AND a.attnum > 0
        AND NOT a.attisdropped
    LOOP
      EXECUTE format('REVOKE SELECT (%I) ON TABLE public.%I FROM anon', column_name, relation_name);
    END LOOP;
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS businesses_public_read ON public.businesses;
DROP POLICY IF EXISTS services_public_read ON public.services;
DROP POLICY IF EXISTS professionals_public_read ON public.professionals;
DROP POLICY IF EXISTS service_professionals_public_read ON public.service_professionals;
DROP POLICY IF EXISTS business_hours_public_read ON public.business_hours;
DROP POLICY IF EXISTS service_categories_public_read ON public.service_categories;
DROP POLICY IF EXISTS time_blocks_public_read ON public.time_blocks;
