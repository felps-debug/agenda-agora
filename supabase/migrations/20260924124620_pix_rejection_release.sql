-- Uma rejeição HTTP definitiva do Asaas (por exemplo, Pix indisponível para
-- subconta não aprovada) não é um POST incerto: pode ser cancelada sem carência.
ALTER TABLE public.deposit_payments
  DROP CONSTRAINT IF EXISTS deposit_payments_pix_attempt_state_check,
  ADD CONSTRAINT deposit_payments_pix_attempt_state_check
    CHECK (pix_attempt_state IN ('nao_tentado', 'post_enviado', 'post_incerto', 'criado', 'rejeitado'));

CREATE OR REPLACE FUNCTION public.mark_deposit_pix_post_started(
  _charge_id uuid,
  _claim_token uuid,
  _lease_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF _charge_id IS NULL OR _claim_token IS NULL THEN
    RAISE EXCEPTION 'Cobrança e token obrigatórios.' USING ERRCODE = '22004';
  END IF;
  IF _lease_seconds IS NULL OR _lease_seconds < 5 OR _lease_seconds > 300 THEN
    RAISE EXCEPTION 'Lease deve ficar entre 5 e 300 segundos.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.deposit_payments dp
  SET pix_attempt_state = 'post_enviado',
      pix_post_started_at = clock_timestamp(),
      pix_claim_expires_at = clock_timestamp() + make_interval(secs => _lease_seconds)
  WHERE dp.id = _charge_id
    AND dp.status = 'pendente'
    AND dp.pix_claim_token = _claim_token
    AND dp.pix_claim_expires_at > clock_timestamp()
    AND dp.expires_at > clock_timestamp()
    AND dp.provider_payment_id IS NULL
    AND (
      dp.pix_attempt_state IN ('nao_tentado', 'rejeitado')
      OR (
        dp.pix_attempt_state = 'post_incerto'
        AND (
          dp.pix_post_started_at IS NULL
          OR dp.pix_post_started_at <= clock_timestamp() - interval '2 minutes'
        )
      )
    );

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_deposit_pix(
  _charge_id uuid,
  _claim_token uuid,
  _outcome text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF _charge_id IS NULL OR _claim_token IS NULL THEN
    RAISE EXCEPTION 'Cobrança e token obrigatórios.' USING ERRCODE = '22004';
  END IF;
  IF _outcome IS NULL OR _outcome NOT IN ('criado', 'falhou', 'rejeitado') THEN
    RAISE EXCEPTION 'Resultado deve ser criado, falhou ou rejeitado.' USING ERRCODE = '22023';
  END IF;

  IF _outcome = 'criado' AND EXISTS (
    SELECT 1 FROM public.deposit_payments dp
    WHERE dp.id = _charge_id
      AND dp.pix_claim_token = _claim_token
      AND dp.provider_payment_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Persistir provider_payment_id antes de liberar como criado.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.deposit_payments dp
  SET pix_attempt_state = CASE
        WHEN _outcome = 'criado' THEN 'criado'
        WHEN _outcome = 'rejeitado' THEN 'rejeitado'
        WHEN dp.pix_attempt_state = 'post_enviado' THEN 'post_incerto'
        ELSE dp.pix_attempt_state
      END,
      pix_claim_token = NULL,
      pix_claim_expires_at = NULL
  WHERE dp.id = _charge_id
    AND dp.pix_claim_token = _claim_token;

  RETURN FOUND;
END;
$$;
