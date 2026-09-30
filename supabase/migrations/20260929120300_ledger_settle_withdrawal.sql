-- Spec 005 (FR-007, FR-008): ponto único e atômico de conclusão de saque.
--
-- Todo caminho que encerra um saque (webhook withdrawal.*, ação manual do Master,
-- falha síncrona do cashout) chama esta função. Ela trava a linha do saque, só
-- transiciona a partir de requested/processing (reentrega/duplicata vira no-op) e
-- acerta o ledger/wallet na mesma transação:
--   paid    locked_cents -= valor (o débito já foi lançado ao aceitar o saque).
--   failed  lançamento withdrawal_reversal (+valor) e locked -> available.
--   canceled idem failed (saque nunca chegou a ser enviado).
-- Se o saque nunca teve débito no ledger (linha legada), só o status muda.

CREATE OR REPLACE FUNCTION public.ledger_settle_withdrawal(
  _withdrawal_id uuid,
  _outcome text,
  _provider_ref text DEFAULT NULL
)
RETURNS TABLE (changed boolean, final_status text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _w public.withdrawals%ROWTYPE;
  _has_debit boolean;
  _reversal_id uuid;
BEGIN
  IF _withdrawal_id IS NULL THEN
    RAISE EXCEPTION 'withdrawal_id é obrigatório.' USING ERRCODE = '22004';
  END IF;
  IF _outcome IS NULL OR _outcome NOT IN ('paid', 'failed', 'canceled') THEN
    RAISE EXCEPTION 'outcome deve ser paid, failed ou canceled.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _w FROM public.withdrawals WHERE id = _withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saque não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF _w.status NOT IN ('requested', 'processing') THEN
    RETURN QUERY SELECT false, _w.status;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.ledger_entries le
    WHERE le.idempotency_key = 'withdrawal_debit:' || _withdrawal_id::text
  ) INTO _has_debit;

  UPDATE public.withdrawals
  SET status = _outcome,
      provider_ref = COALESCE(_provider_ref, provider_ref),
      updated_at = now()
  WHERE id = _withdrawal_id;

  IF _has_debit THEN
    IF _outcome = 'paid' THEN
      UPDATE public.wallets AS w
      SET locked_cents = w.locked_cents - _w.amount_cents, updated_at = now()
      WHERE w.business_id = _w.business_id;
    ELSE
      INSERT INTO public.ledger_entries
        (business_id, type, amount_cents, withdrawal_id, idempotency_key, description)
      VALUES
        (_w.business_id, 'withdrawal_reversal', _w.amount_cents, _withdrawal_id,
         'withdrawal_reversal:' || _withdrawal_id::text, 'Saque revertido: payout não concluído')
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id INTO _reversal_id;

      -- Só mexe na wallet se este chamador de fato lançou a reversão (evita devolver o
      -- valor duas vezes caso ledger_reverse_withdrawal já tenha sido chamada antes).
      IF _reversal_id IS NOT NULL THEN
        UPDATE public.wallets AS w
        SET locked_cents = w.locked_cents - _w.amount_cents,
            available_cents = w.available_cents + _w.amount_cents,
            updated_at = now()
        WHERE w.business_id = _w.business_id;
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT true, _outcome;
END;
$$;

REVOKE ALL ON FUNCTION public.ledger_settle_withdrawal(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_settle_withdrawal(uuid, text, text) TO service_role;

-- Rollback: DROP FUNCTION IF EXISTS public.ledger_settle_withdrawal(uuid, text, text);
