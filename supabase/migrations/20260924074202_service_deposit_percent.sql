-- Spec 002 / T033: sinal percentual por serviço, aditivo e compatível com o código anterior.
--
-- deposit_mode = 'fixed'   usa services.deposit_cents (comportamento atual; padrão).
-- deposit_mode = 'percent' usa round(price_cents * deposit_percent_bps / 10000).
-- deposit_percent_bps em pontos-base: 0..10000 (0% a 100%).
--
-- Serviços existentes ficam 'fixed' com 0 bps, sem mudar o sinal efetivo.
-- Nenhuma linha é alterada ou apagada por esta migration.

-- Pré-condição (data-model.md): price_cents >= 0 e deposit_cents >= 0. Com valores
-- negativos legados a migration falha antes de qualquer alteração de schema; os dados
-- ficam intactos e precisam ser corrigidos por decisão explícita antes de reaplicar.
DO $$
DECLARE
  _negative_price integer;
  _negative_deposit integer;
BEGIN
  SELECT count(*) INTO _negative_price FROM public.services WHERE price_cents < 0;
  SELECT count(*) INTO _negative_deposit FROM public.services WHERE deposit_cents < 0;
  IF _negative_price > 0 OR _negative_deposit > 0 THEN
    RAISE EXCEPTION
      'services com valores negativos: % com price_cents < 0 e % com deposit_cents < 0.',
      _negative_price, _negative_deposit
      USING ERRCODE = '23514',
            HINT = 'Corrija esses serviços antes de aplicar a migration service_deposit_percent.';
  END IF;
END;
$$;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS deposit_mode text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS deposit_percent_bps integer NOT NULL DEFAULT 0;

-- Constraints criadas já validadas (sem NOT VALID); DROP IF EXISTS mantém a
-- migration reaplicável.
ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_deposit_mode_check,
  ADD CONSTRAINT services_deposit_mode_check
    CHECK (deposit_mode IN ('fixed', 'percent')),
  DROP CONSTRAINT IF EXISTS services_deposit_percent_bps_check,
  ADD CONSTRAINT services_deposit_percent_bps_check
    CHECK (deposit_percent_bps BETWEEN 0 AND 10000),
  DROP CONSTRAINT IF EXISTS services_price_cents_nonnegative,
  ADD CONSTRAINT services_price_cents_nonnegative
    CHECK (price_cents >= 0),
  DROP CONSTRAINT IF EXISTS services_deposit_cents_nonnegative,
  ADD CONSTRAINT services_deposit_cents_nonnegative
    CHECK (deposit_cents >= 0);

COMMENT ON COLUMN public.services.deposit_mode IS
  'fixed (usa deposit_cents) | percent (usa deposit_percent_bps sobre price_cents)';
COMMENT ON COLUMN public.services.deposit_percent_bps IS
  'Percentual do sinal em pontos-base (0..10000); usado quando deposit_mode = percent.';
