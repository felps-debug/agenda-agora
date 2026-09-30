-- Spec 005: a coluna de saída available_cents de ledger_request_withdrawal colidia
-- com wallets.available_cents dentro do UPDATE (erro 42702 no smoke test). Mesma
-- assinatura; colunas passam a ser qualificadas pelo alias da tabela.

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

  UPDATE public.wallets AS w
  SET available_cents = w.available_cents - _amount_cents,
      locked_cents = w.locked_cents + _amount_cents,
      updated_at = now()
  WHERE w.business_id = _business_id
  RETURNING w.available_cents INTO _current_available;

  RETURN QUERY SELECT _entry_id, true, _current_available;
END;
$$;

-- Rollback: reaplicar a definição da migration 20260929120000_ledger_wallet.sql
-- (que contém o defeito de ambiguidade) não é desejável; para desfazer o ledger inteiro use
-- o bloco de rollback daquela migration.
