CREATE OR REPLACE FUNCTION public.enforce_ledger_reference_business()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.payment_id IS NOT NULL THEN
    PERFORM 1 FROM public.deposit_payments AS payment
    WHERE payment.id = NEW.payment_id AND payment.business_id = NEW.business_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ledger payment_id must belong to the same business_id' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.withdrawal_id IS NOT NULL THEN
    PERFORM 1 FROM public.withdrawals AS withdrawal
    WHERE withdrawal.id = NEW.withdrawal_id AND withdrawal.business_id = NEW.business_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ledger withdrawal_id must belong to the same business_id' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER ledger_entries_reference_business
  BEFORE INSERT OR UPDATE OF business_id, payment_id, withdrawal_id ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ledger_reference_business();

CREATE OR REPLACE FUNCTION public.prevent_referenced_business_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.business_id IS DISTINCT FROM OLD.business_id THEN
    IF TG_TABLE_NAME = 'deposit_payments' AND EXISTS (
      SELECT 1 FROM public.ledger_entries AS entry
      WHERE entry.payment_id = OLD.id AND entry.business_id IS DISTINCT FROM NEW.business_id
    ) THEN
      RAISE EXCEPTION 'deposit payment business_id conflicts with existing ledger entries' USING ERRCODE = '23514';
    END IF;

    IF TG_TABLE_NAME = 'withdrawals' AND EXISTS (
      SELECT 1 FROM public.ledger_entries AS entry
      WHERE entry.withdrawal_id = OLD.id AND entry.business_id IS DISTINCT FROM NEW.business_id
    ) THEN
      RAISE EXCEPTION 'withdrawal business_id conflicts with existing ledger entries' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER deposit_payments_referenced_business_immutable
  BEFORE UPDATE OF business_id ON public.deposit_payments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_referenced_business_change();

CREATE TRIGGER withdrawals_referenced_business_immutable
  BEFORE UPDATE OF business_id ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.prevent_referenced_business_change();

REVOKE ALL ON FUNCTION public.enforce_ledger_reference_business() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_referenced_business_change() FROM PUBLIC, anon, authenticated;
