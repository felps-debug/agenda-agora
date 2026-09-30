-- Spec 005: ledger financeiro e saldo por estabelecimento.
--
-- Substitui o cálculo de saldo on-the-fly (computeBalance, que somava
-- deposit_payments/withdrawals a cada consulta) por um razão contábil
-- (ledger_entries) imutável e auditável, com uma projeção de saldo (wallets)
-- mantida transacionalmente junto com cada lançamento.
--
-- Tipos de lançamento (ledger_entries.type):
--   payment_credit      crédito de um sinal Pix confirmado.
--   withdrawal_debit     débito ao aceitar um pedido de saque (move
--                        available -> locked).
--   withdrawal_reversal  estorno de um saque cujo payout falhou (move
--                        locked -> available de volta).
--   refund_debit         débito de estorno/chargeback de um pagamento já
--                        creditado; pode deixar available_cents negativo.
--   adjustment           correção administrativa manual (Master).
--
-- Nenhum lançamento é alterado ou apagado depois de inserido (trigger
-- ledger_entries_immutable abaixo); toda correção é um novo lançamento.
--
-- Idempotência: cada função de escrita recebe um _idempotency_key único.
-- Se a chave já existe, a função retorna o lançamento existente em vez de
-- duplicar — mesma defesa em profundidade da inbox agpay_webhook_events,
-- aplicada aqui como segunda camada (a primeira é o dedupe_hash da inbox).

CREATE TABLE public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'payment_credit', 'withdrawal_debit', 'withdrawal_reversal', 'refund_debit', 'adjustment'
  )),
  amount_cents integer NOT NULL CHECK (amount_cents <> 0),
  status text NOT NULL DEFAULT 'completed' CHECK (status = 'completed'),
  payment_id uuid REFERENCES public.deposit_payments(id),
  withdrawal_id uuid REFERENCES public.withdrawals(id),
  idempotency_key text NOT NULL UNIQUE,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ledger_entries_business_created_idx
  ON public.ledger_entries (business_id, created_at DESC);
CREATE INDEX ledger_entries_payment_idx
  ON public.ledger_entries (payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX ledger_entries_withdrawal_idx
  ON public.ledger_entries (withdrawal_id) WHERE withdrawal_id IS NOT NULL;

COMMENT ON TABLE public.ledger_entries IS
  'Razão contábil imutável. Nunca UPDATE/DELETE — correções são novos lançamentos (adjustment).';

CREATE OR REPLACE FUNCTION public.ledger_entries_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'public.ledger_entries é somente-inserção; % não é permitido em lançamento confirmado', TG_OP;
END;
$$;

CREATE TRIGGER ledger_entries_no_update
  BEFORE UPDATE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.ledger_entries_immutable();

CREATE TRIGGER ledger_entries_no_delete
  BEFORE DELETE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.ledger_entries_immutable();

CREATE TABLE public.wallets (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  available_cents integer NOT NULL DEFAULT 0,
  pending_cents integer NOT NULL DEFAULT 0,
  locked_cents integer NOT NULL DEFAULT 0 CHECK (locked_cents >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.wallets IS
  'Projeção do saldo por estabelecimento. Só escrita dentro das funções ledger_*, nunca diretamente — available_cents pode ficar negativo (estorno pós-saque, FR-014).';

CREATE TRIGGER wallets_updated
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.deposit_payments
  ADD COLUMN gateway_fee_cents integer,
  ADD COLUMN platform_commission_percent_snapshot numeric(5,2),
  ADD COLUMN platform_commission_flat_cents integer,
  ADD COLUMN platform_commission_cents integer,
  ADD COLUMN net_amount_cents integer;

COMMENT ON COLUMN public.deposit_payments.net_amount_cents IS
  'amount_cents - gateway_fee_cents - platform_commission_cents, congelado no momento da confirmação (nunca recalculado).';

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can read own ledger entries" ON public.ledger_entries
  FOR SELECT USING (exists (
    SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid()
  ));
REVOKE INSERT, UPDATE, DELETE ON public.ledger_entries FROM anon, authenticated;
GRANT SELECT ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can read own wallet" ON public.wallets
  FOR SELECT USING (exists (
    SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid()
  ));
REVOKE INSERT, UPDATE, DELETE ON public.wallets FROM anon, authenticated;
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;

-- Crédito de pagamento (FR-001, FR-003). Idempotente por _idempotency_key.
CREATE OR REPLACE FUNCTION public.ledger_credit_payment(
  _business_id uuid,
  _payment_id uuid,
  _amount_cents integer,
  _idempotency_key text,
  _description text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (entry_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _entry_id uuid;
BEGIN
  IF _business_id IS NULL OR _idempotency_key IS NULL THEN
    RAISE EXCEPTION 'business_id e idempotency_key são obrigatórios.' USING ERRCODE = '22004';
  END IF;
  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN
    RAISE EXCEPTION 'amount_cents deve ser positivo para um crédito.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.ledger_entries
      (business_id, type, amount_cents, payment_id, idempotency_key, description, metadata)
    VALUES
      (_business_id, 'payment_credit', _amount_cents, _payment_id, _idempotency_key, _description, _metadata)
    RETURNING id INTO _entry_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT le.id INTO _entry_id FROM public.ledger_entries le WHERE le.idempotency_key = _idempotency_key;
    RETURN QUERY SELECT _entry_id, false;
    RETURN;
  END;

  INSERT INTO public.wallets (business_id, available_cents)
  VALUES (_business_id, _amount_cents)
  ON CONFLICT (business_id) DO UPDATE
    SET available_cents = public.wallets.available_cents + _amount_cents,
        updated_at = now();

  RETURN QUERY SELECT _entry_id, true;
END;
$$;

-- Solicitação de saque (FR-006, FR-007). Trava a linha da wallet com
-- FOR UPDATE dentro da transação do chamador para impedir double-spending
-- entre solicitações concorrentes do mesmo estabelecimento.
CREATE OR REPLACE FUNCTION public.ledger_request_withdrawal(
  _business_id uuid,
  _withdrawal_id uuid,
  _amount_cents integer,
  _idempotency_key text
)
RETURNS TABLE (entry_id uuid, accepted boolean, available_cents integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _entry_id uuid;
  _current_available integer;
BEGIN
  IF _business_id IS NULL OR _withdrawal_id IS NULL OR _idempotency_key IS NULL THEN
    RAISE EXCEPTION 'business_id, withdrawal_id e idempotency_key são obrigatórios.' USING ERRCODE = '22004';
  END IF;
  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN
    RAISE EXCEPTION 'amount_cents deve ser positivo para um saque.' USING ERRCODE = '22023';
  END IF;

  SELECT le.id INTO _entry_id FROM public.ledger_entries le WHERE le.idempotency_key = _idempotency_key;
  IF _entry_id IS NOT NULL THEN
    SELECT w.available_cents INTO _current_available FROM public.wallets w WHERE w.business_id = _business_id;
    RETURN QUERY SELECT _entry_id, true, _current_available;
    RETURN;
  END IF;

  INSERT INTO public.wallets (business_id) VALUES (_business_id)
  ON CONFLICT (business_id) DO NOTHING;

  SELECT w.available_cents INTO _current_available
  FROM public.wallets w
  WHERE w.business_id = _business_id
  FOR UPDATE;

  IF _current_available < _amount_cents THEN
    RETURN QUERY SELECT NULL::uuid, false, _current_available;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.ledger_entries
      (business_id, type, amount_cents, withdrawal_id, idempotency_key, description)
    VALUES
      (_business_id, 'withdrawal_debit', -_amount_cents, _withdrawal_id, _idempotency_key, 'Saque solicitado')
    RETURNING id INTO _entry_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT le.id INTO _entry_id FROM public.ledger_entries le WHERE le.idempotency_key = _idempotency_key;
    SELECT w.available_cents INTO _current_available FROM public.wallets w WHERE w.business_id = _business_id;
    RETURN QUERY SELECT _entry_id, true, _current_available;
    RETURN;
  END;

  UPDATE public.wallets
  SET available_cents = available_cents - _amount_cents,
      locked_cents = locked_cents + _amount_cents,
      updated_at = now()
  WHERE business_id = _business_id
  RETURNING available_cents INTO _current_available;

  RETURN QUERY SELECT _entry_id, true, _current_available;
END;
$$;

-- Reversão de saque cujo payout falhou (FR-008). Idempotente.
CREATE OR REPLACE FUNCTION public.ledger_reverse_withdrawal(
  _business_id uuid,
  _withdrawal_id uuid,
  _amount_cents integer,
  _idempotency_key text
)
RETURNS TABLE (entry_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _entry_id uuid;
BEGIN
  IF _business_id IS NULL OR _withdrawal_id IS NULL OR _idempotency_key IS NULL THEN
    RAISE EXCEPTION 'business_id, withdrawal_id e idempotency_key são obrigatórios.' USING ERRCODE = '22004';
  END IF;
  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN
    RAISE EXCEPTION 'amount_cents deve ser positivo para uma reversão.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.ledger_entries
      (business_id, type, amount_cents, withdrawal_id, idempotency_key, description)
    VALUES
      (_business_id, 'withdrawal_reversal', _amount_cents, _withdrawal_id, _idempotency_key, 'Saque revertido: payout falhou')
    RETURNING id INTO _entry_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT le.id INTO _entry_id FROM public.ledger_entries le WHERE le.idempotency_key = _idempotency_key;
    RETURN QUERY SELECT _entry_id, false;
    RETURN;
  END;

  UPDATE public.wallets
  SET locked_cents = locked_cents - _amount_cents,
      available_cents = available_cents + _amount_cents,
      updated_at = now()
  WHERE business_id = _business_id;

  RETURN QUERY SELECT _entry_id, true;
END;
$$;

-- Débito de estorno/chargeback de um pagamento já creditado (FR-009,
-- FR-014). Pode deixar available_cents negativo de propósito.
CREATE OR REPLACE FUNCTION public.ledger_debit_refund(
  _business_id uuid,
  _payment_id uuid,
  _amount_cents integer,
  _idempotency_key text,
  _description text
)
RETURNS TABLE (entry_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _entry_id uuid;
BEGIN
  IF _business_id IS NULL OR _idempotency_key IS NULL THEN
    RAISE EXCEPTION 'business_id e idempotency_key são obrigatórios.' USING ERRCODE = '22004';
  END IF;
  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN
    RAISE EXCEPTION 'amount_cents deve ser positivo para um débito de estorno.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.ledger_entries
      (business_id, type, amount_cents, payment_id, idempotency_key, description)
    VALUES
      (_business_id, 'refund_debit', -_amount_cents, _payment_id, _idempotency_key, _description)
    RETURNING id INTO _entry_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT le.id INTO _entry_id FROM public.ledger_entries le WHERE le.idempotency_key = _idempotency_key;
    RETURN QUERY SELECT _entry_id, false;
    RETURN;
  END;

  INSERT INTO public.wallets (business_id, available_cents)
  VALUES (_business_id, -_amount_cents)
  ON CONFLICT (business_id) DO UPDATE
    SET available_cents = public.wallets.available_cents - _amount_cents,
        updated_at = now();

  RETURN QUERY SELECT _entry_id, true;
END;
$$;

-- Ajuste administrativo manual (Master), sempre um lançamento novo
-- (FR-010) — nunca reescreve um lançamento existente.
CREATE OR REPLACE FUNCTION public.ledger_adjustment(
  _business_id uuid,
  _amount_cents integer,
  _idempotency_key text,
  _description text
)
RETURNS TABLE (entry_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _entry_id uuid;
BEGIN
  IF _business_id IS NULL OR _idempotency_key IS NULL THEN
    RAISE EXCEPTION 'business_id e idempotency_key são obrigatórios.' USING ERRCODE = '22004';
  END IF;
  IF _amount_cents IS NULL OR _amount_cents = 0 THEN
    RAISE EXCEPTION 'amount_cents não pode ser zero em um ajuste.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.ledger_entries
      (business_id, type, amount_cents, idempotency_key, description)
    VALUES
      (_business_id, 'adjustment', _amount_cents, _idempotency_key, _description)
    RETURNING id INTO _entry_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT le.id INTO _entry_id FROM public.ledger_entries le WHERE le.idempotency_key = _idempotency_key;
    RETURN QUERY SELECT _entry_id, false;
    RETURN;
  END;

  INSERT INTO public.wallets (business_id, available_cents)
  VALUES (_business_id, _amount_cents)
  ON CONFLICT (business_id) DO UPDATE
    SET available_cents = public.wallets.available_cents + _amount_cents,
        updated_at = now();

  RETURN QUERY SELECT _entry_id, true;
END;
$$;

REVOKE ALL ON FUNCTION public.ledger_credit_payment(uuid, uuid, integer, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_request_withdrawal(uuid, uuid, integer, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_reverse_withdrawal(uuid, uuid, integer, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_debit_refund(uuid, uuid, integer, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ledger_adjustment(uuid, integer, text, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ledger_credit_payment(uuid, uuid, integer, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_request_withdrawal(uuid, uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_reverse_withdrawal(uuid, uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_debit_refund(uuid, uuid, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ledger_adjustment(uuid, integer, text, text) TO service_role;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.ledger_adjustment(uuid, integer, text, text);
-- DROP FUNCTION IF EXISTS public.ledger_debit_refund(uuid, uuid, integer, text, text);
-- DROP FUNCTION IF EXISTS public.ledger_reverse_withdrawal(uuid, uuid, integer, text);
-- DROP FUNCTION IF EXISTS public.ledger_request_withdrawal(uuid, uuid, integer, text);
-- DROP FUNCTION IF EXISTS public.ledger_credit_payment(uuid, uuid, integer, text, text, jsonb);
-- ALTER TABLE public.deposit_payments
--   DROP COLUMN net_amount_cents, DROP COLUMN platform_commission_cents,
--   DROP COLUMN platform_commission_flat_cents, DROP COLUMN platform_commission_percent_snapshot,
--   DROP COLUMN gateway_fee_cents;
-- DROP TABLE public.wallets;
-- DROP TRIGGER ledger_entries_no_delete ON public.ledger_entries;
-- DROP TRIGGER ledger_entries_no_update ON public.ledger_entries;
-- DROP FUNCTION IF EXISTS public.ledger_entries_immutable();
-- DROP TABLE public.ledger_entries;
