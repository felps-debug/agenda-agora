-- Spec 002 / T016: troca atômica de service_professionals de um profissional.
--
-- SECURITY INVOKER: roda com o JWT de quem chama, então as RLS de professionals,
-- services e service_professionals continuam valendo além das validações abaixo.
-- Deve ser chamada pelo cliente autenticado do dono (context.supabase), não por
-- service role: sem auth.uid() a checagem de dono falha.
-- A chamada RPC é uma única transação: qualquer RAISE desfaz o DELETE e o INSERT.

CREATE OR REPLACE FUNCTION public.replace_professional_services(
  _business_id uuid,
  _professional_id uuid,
  _service_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _requested uuid[];
  _valid_count integer;
BEGIN
  IF _business_id IS NULL OR _professional_id IS NULL OR _service_ids IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes.' USING ERRCODE = '22004';
  END IF;

  IF array_position(_service_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Lista de serviços contém valor nulo.' USING ERRCODE = '22004';
  END IF;

  IF NOT public.owns_business(_business_id) THEN
    RAISE EXCEPTION 'Somente o dono pode gerenciar os vínculos da equipe.' USING ERRCODE = '42501';
  END IF;

  -- Trava o profissional para serializar trocas concorrentes do mesmo profissional.
  PERFORM 1
  FROM public.professionals p
  WHERE p.id = _professional_id
    AND p.business_id = _business_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profissional não encontrado neste negócio.' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(array_agg(DISTINCT requested.service_id), '{}'::uuid[])
  INTO _requested
  FROM unnest(_service_ids) AS requested(service_id);

  SELECT count(*)
  INTO _valid_count
  FROM public.services sv
  WHERE sv.business_id = _business_id
    AND sv.id = ANY (_requested);

  IF _valid_count <> cardinality(_requested) THEN
    RAISE EXCEPTION 'Há serviço que não pertence a este negócio.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.service_professionals sp
  WHERE sp.professional_id = _professional_id
    AND sp.business_id = _business_id;

  INSERT INTO public.service_professionals (business_id, professional_id, service_id)
  SELECT _business_id, _professional_id, requested.service_id
  FROM unnest(_requested) AS requested(service_id);
END;
$$;

REVOKE ALL ON FUNCTION public.replace_professional_services(uuid, uuid, uuid[])
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.replace_professional_services(uuid, uuid, uuid[])
  TO authenticated;
