-- API-006: persist the service and its professional links in one transaction.
-- SECURITY INVOKER keeps the caller's RLS policies active throughout the RPC.
CREATE OR REPLACE FUNCTION public.save_service_with_professionals(
  _service_id uuid,
  _business_id uuid,
  _name text,
  _duration_minutes integer,
  _price_cents integer,
  _requires_deposit boolean,
  _deposit_mode text,
  _deposit_percent_bps integer,
  _deposit_cents integer,
  _description text,
  _is_combo boolean,
  _available_days smallint[],
  _show_price boolean,
  _show_duration boolean,
  _show_service boolean,
  _image_path text,
  _professional_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _saved_service_id uuid;
BEGIN
  IF _business_id IS NULL OR _name IS NULL OR _duration_minutes IS NULL
    OR _price_cents IS NULL OR _requires_deposit IS NULL OR _deposit_mode IS NULL
    OR _deposit_percent_bps IS NULL OR _deposit_cents IS NULL OR _is_combo IS NULL
    OR _available_days IS NULL OR _show_price IS NULL OR _show_duration IS NULL
    OR _show_service IS NULL OR _professional_ids IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes.' USING ERRCODE = '22004';
  END IF;

  IF array_position(_professional_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Lista de profissionais contém valor nulo.' USING ERRCODE = '22004';
  END IF;

  IF NOT public.owns_business(_business_id) THEN
    RAISE EXCEPTION 'Somente o dono pode gerenciar os serviços do negócio.' USING ERRCODE = '42501';
  END IF;

  -- Lock the business to serialize this catalog write against concurrent edits
  -- to its service/professional links.
  PERFORM 1
  FROM public.businesses AS business
  WHERE business.id = _business_id
    AND business.owner_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Negócio não encontrado para o proprietário.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(_professional_ids) AS requested(professional_id)
    LEFT JOIN public.professionals AS professional
      ON professional.id = requested.professional_id
      AND professional.business_id = _business_id
    WHERE professional.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Há profissional que não pertence a este negócio.' USING ERRCODE = '42501';
  END IF;

  IF _service_id IS NULL THEN
    INSERT INTO public.services (
      business_id, name, duration_minutes, price_cents, requires_deposit,
      deposit_mode, deposit_percent_bps, deposit_cents, description, is_combo,
      available_days, show_price, show_duration, show_service, image_path
    ) VALUES (
      _business_id, _name, _duration_minutes, _price_cents, _requires_deposit,
      _deposit_mode, _deposit_percent_bps, _deposit_cents, _description, _is_combo,
      _available_days, _show_price, _show_duration, _show_service, _image_path
    )
    RETURNING id INTO _saved_service_id;
  ELSE
    UPDATE public.services
    SET name = _name,
        duration_minutes = _duration_minutes,
        price_cents = _price_cents,
        requires_deposit = _requires_deposit,
        deposit_mode = _deposit_mode,
        deposit_percent_bps = _deposit_percent_bps,
        deposit_cents = _deposit_cents,
        description = _description,
        is_combo = _is_combo,
        available_days = _available_days,
        show_price = _show_price,
        show_duration = _show_duration,
        show_service = _show_service,
        image_path = _image_path
    WHERE id = _service_id
      AND business_id = _business_id
    RETURNING id INTO _saved_service_id;

    IF _saved_service_id IS NULL THEN
      RAISE EXCEPTION 'Serviço não encontrado neste negócio.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  DELETE FROM public.service_professionals
  WHERE service_id = _saved_service_id
    AND business_id = _business_id;

  INSERT INTO public.service_professionals (business_id, service_id, professional_id)
  SELECT _business_id, _saved_service_id, requested.professional_id
  FROM unnest(_professional_ids) AS requested(professional_id);

  RETURN _saved_service_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_service_with_professionals(
  uuid, uuid, text, integer, integer, boolean, text, integer, integer, text,
  boolean, smallint[], boolean, boolean, boolean, text, uuid[]
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.save_service_with_professionals(
  uuid, uuid, text, integer, integer, boolean, text, integer, integer, text,
  boolean, smallint[], boolean, boolean, boolean, text, uuid[]
) TO authenticated;

-- The category row and all service.category_id changes used by the catalog dialog
-- are also a single transaction. ON DELETE SET NULL already makes category removal
-- atomic at the database boundary.
CREATE OR REPLACE FUNCTION public.save_service_category_with_services(
  _category_id uuid,
  _business_id uuid,
  _name text,
  _active boolean,
  _service_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _saved_category_id uuid;
BEGIN
  IF _business_id IS NULL OR _name IS NULL OR _active IS NULL OR _service_ids IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes.' USING ERRCODE = '22004';
  END IF;
  IF array_position(_service_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Lista de serviços contém valor nulo.' USING ERRCODE = '22004';
  END IF;
  IF NOT public.owns_business(_business_id) THEN
    RAISE EXCEPTION 'Somente o dono pode gerenciar as categorias do negócio.' USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.businesses AS business
  WHERE business.id = _business_id
    AND business.owner_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Negócio não encontrado para o proprietário.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(_service_ids) AS requested(service_id)
    LEFT JOIN public.services AS service
      ON service.id = requested.service_id
      AND service.business_id = _business_id
    WHERE service.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Há serviço que não pertence a este negócio.' USING ERRCODE = '42501';
  END IF;

  IF _category_id IS NULL THEN
    INSERT INTO public.service_categories (business_id, name, active)
    VALUES (_business_id, _name, _active)
    RETURNING id INTO _saved_category_id;
  ELSE
    UPDATE public.service_categories
    SET name = _name,
        active = _active
    WHERE id = _category_id
      AND business_id = _business_id
    RETURNING id INTO _saved_category_id;
    IF _saved_category_id IS NULL THEN
      RAISE EXCEPTION 'Categoria não encontrada neste negócio.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  UPDATE public.services
  SET category_id = NULL
  WHERE business_id = _business_id
    AND category_id = _saved_category_id
    AND NOT (id = ANY(_service_ids));

  UPDATE public.services
  SET category_id = _saved_category_id
  WHERE business_id = _business_id
    AND id = ANY(_service_ids);

  RETURN _saved_category_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_service_category_with_services(uuid, uuid, text, boolean, uuid[])
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.save_service_category_with_services(uuid, uuid, text, boolean, uuid[])
  TO authenticated;
