-- Spec 002 / T023 (parte SQL): serialização da geração Pix por deposit_payments.id
-- entre instâncias diferentes do servidor, com claim/release por token e lease,
-- e estado persistido da tentativa de POST no Asaas.
--
-- Estados de pix_attempt_state:
--   nao_tentado   nenhum POST /payments foi enviado para esta cobrança.
--   post_enviado  o detentor do claim anunciou que vai enviar o POST agora.
--   post_incerto  o POST pode ter criado a cobrança, sem confirmação. Antes de
--                 novo POST, buscar por externalReference = deposit_payments.id.
--   criado        provider_payment_id persistido; nunca enviar novo POST.
--
-- Transições:
--   claim:        post_enviado com lease vencido -> post_incerto (detentor anterior
--                 caiu depois de anunciar o POST); demais estados preservados.
--   post_started: nao_tentado | post_incerto -> post_enviado (só com claim válido e sem
--                 provider_payment_id). post_incerto só volta a permitir POST depois
--                 de 2 minutos do POST anterior (tempo para a busca por
--                 externalReference refletir a cobrança criada); antes disso, não enviar.
--   release:      'criado' -> criado (exige provider_payment_id; usar sempre que a
--                 cobrança foi localizada e gravada, mesmo se o QR falhou);
--                 'falhou' -> post_enviado vira post_incerto; demais preservados.
--   Nenhuma transição volta para nao_tentado. POST também exige expires_at futuro.
--   Cancelamento/expiração local (asaas-events.server.ts) adquire o mesmo claim e
--   adia enquanto houver claim válido ou post_incerto dentro da carência de 2 minutos.
--
-- Funções só para service_role (server functions). Retornam apenas controle,
-- nunca CPF/CNPJ, QR, cliente ou dados do pagador.

ALTER TABLE public.deposit_payments
  ADD COLUMN IF NOT EXISTS pix_attempt_state text NOT NULL DEFAULT 'nao_tentado',
  ADD COLUMN IF NOT EXISTS pix_claim_token uuid,
  ADD COLUMN IF NOT EXISTS pix_claim_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS pix_post_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS pix_attempts integer NOT NULL DEFAULT 0;

-- Backfill conservador antes das constraints: com provider_payment_id a cobrança
-- existe; com cliente Asaas vinculado e sem pagamento, o código anterior pode ter
-- enviado o POST sem registrar.
UPDATE public.deposit_payments
SET pix_attempt_state = 'criado'
WHERE provider_payment_id IS NOT NULL
  AND pix_attempt_state = 'nao_tentado';

UPDATE public.deposit_payments
SET pix_attempt_state = 'post_incerto'
WHERE provider_payment_id IS NULL
  AND asaas_customer_id IS NOT NULL
  AND pix_attempt_state = 'nao_tentado';

ALTER TABLE public.deposit_payments
  DROP CONSTRAINT IF EXISTS deposit_payments_pix_attempt_state_check,
  ADD CONSTRAINT deposit_payments_pix_attempt_state_check
    CHECK (pix_attempt_state IN ('nao_tentado', 'post_enviado', 'post_incerto', 'criado')),
  DROP CONSTRAINT IF EXISTS deposit_payments_pix_created_has_payment_check,
  ADD CONSTRAINT deposit_payments_pix_created_has_payment_check
    CHECK (pix_attempt_state <> 'criado' OR provider_payment_id IS NOT NULL),
  DROP CONSTRAINT IF EXISTS deposit_payments_pix_claim_pair_check,
  ADD CONSTRAINT deposit_payments_pix_claim_pair_check
    CHECK ((pix_claim_token IS NULL) = (pix_claim_expires_at IS NULL)),
  DROP CONSTRAINT IF EXISTS deposit_payments_pix_attempts_check,
  ADD CONSTRAINT deposit_payments_pix_attempts_check
    CHECK (pix_attempts >= 0);

COMMENT ON COLUMN public.deposit_payments.pix_attempt_state IS
  'nao_tentado | post_enviado | post_incerto | criado — ver migration deposit_pix_retry';
COMMENT ON COLUMN public.deposit_payments.pix_claim_token IS
  'Token do detentor atual do claim de geração Pix; NULL quando livre.';

-- Adquire o claim. O UPDATE trava a linha; em Read Committed o concorrente espera
-- e reavalia o WHERE sobre a versão nova, então só um recebe acquired = true.
CREATE OR REPLACE FUNCTION public.claim_deposit_pix(
  _charge_id uuid,
  _lease_seconds integer DEFAULT 60
)
RETURNS TABLE (
  acquired boolean,
  reason text,
  claim_token uuid,
  lease_expires_at timestamptz,
  attempt_state text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _token uuid := gen_random_uuid();
  _expires_at timestamptz;
  _state text;
  _row_status text;
BEGIN
  IF _charge_id IS NULL THEN
    RAISE EXCEPTION 'Cobrança obrigatória.' USING ERRCODE = '22004';
  END IF;
  IF _lease_seconds IS NULL OR _lease_seconds < 5 OR _lease_seconds > 300 THEN
    RAISE EXCEPTION 'Lease deve ficar entre 5 e 300 segundos.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.deposit_payments dp
  SET pix_claim_token = _token,
      pix_claim_expires_at = clock_timestamp() + make_interval(secs => _lease_seconds),
      pix_attempt_state = CASE
        WHEN dp.pix_attempt_state = 'post_enviado' THEN 'post_incerto'
        ELSE dp.pix_attempt_state
      END,
      pix_attempts = dp.pix_attempts + 1
  WHERE dp.id = _charge_id
    AND dp.status = 'pendente'
    AND (dp.pix_claim_token IS NULL OR dp.pix_claim_expires_at <= clock_timestamp())
  RETURNING dp.pix_claim_expires_at, dp.pix_attempt_state
  INTO _expires_at, _state;

  IF FOUND THEN
    RETURN QUERY SELECT true, 'ok'::text, _token, _expires_at, _state;
    RETURN;
  END IF;

  SELECT dp.status INTO _row_status
  FROM public.deposit_payments dp
  WHERE dp.id = _charge_id;

  RETURN QUERY SELECT
    false,
    CASE
      WHEN _row_status IS NULL THEN 'inexistente'
      WHEN _row_status <> 'pendente' THEN 'inativa'
      ELSE 'ocupada'
    END,
    NULL::uuid,
    NULL::timestamptz,
    NULL::text;
END;
$$;

-- Anuncia o POST /payments. Só retorna true com claim válido e estado que permite
-- POST; false significa "não envie". Renova o lease para cobrir o POST e o QR.
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
      dp.pix_attempt_state = 'nao_tentado'
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

-- Libera o claim registrando o resultado. false = claim perdido (lease vencido e
-- outro detentor): só vale como sucesso o que já foi gravado filtrando pelo token.
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
  IF _outcome IS NULL OR _outcome NOT IN ('criado', 'falhou') THEN
    RAISE EXCEPTION 'Resultado deve ser criado ou falhou.' USING ERRCODE = '22023';
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

REVOKE ALL ON FUNCTION public.claim_deposit_pix(uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_deposit_pix_post_started(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_deposit_pix(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_deposit_pix(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_deposit_pix_post_started(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_deposit_pix(uuid, uuid, text) TO service_role;
