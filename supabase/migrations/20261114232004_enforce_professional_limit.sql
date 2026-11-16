CREATE OR REPLACE FUNCTION public.enforce_professional_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  professional_count integer;
  excluded_professional_id uuid;
BEGIN
  -- Serializa inclusões e transferências do mesmo estabelecimento antes da contagem.
  PERFORM 1
  FROM public.businesses
  WHERE id = NEW.business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW; -- a FK continua responsável por rejeitar business_id inexistente.
  END IF;

  IF TG_OP = 'UPDATE' THEN
    excluded_professional_id := OLD.id;
  END IF;

  SELECT count(*)::integer
  INTO professional_count
  FROM public.professionals AS professional
  WHERE professional.business_id = NEW.business_id
    AND professional.id IS DISTINCT FROM excluded_professional_id;

  IF professional_count >= 10 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Limite de 10 profissionais atingido neste estabelecimento.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER professionals_enforce_limit
BEFORE INSERT OR UPDATE OF business_id ON public.professionals
FOR EACH ROW
EXECUTE FUNCTION public.enforce_professional_limit();
