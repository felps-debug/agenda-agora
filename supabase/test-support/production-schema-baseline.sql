


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."app_role" AS ENUM (
    'super_admin',
    'owner',
    'professional'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_logos_image_business_id"("_name" "text") RETURNS "uuid"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
  SELECT CASE
    WHEN _name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(logo-[^/]+|services/[^/]+)\.(png|jpe?g|webp)$'
      THEN split_part(_name, '/', 1)::uuid
  END;
$_$;


ALTER FUNCTION "public"."business_logos_image_business_id"("_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_professional_photo_business_id"("_name" "text") RETURNS "uuid"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
  SELECT CASE WHEN _name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/professional/[^/]+\.(png|jpe?g|webp)$'
    THEN split_part(_name, '/', 1)::uuid END;
$_$;


ALTER FUNCTION "public"."business_professional_photo_business_id"("_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."business_visual_asset_business_id"("_name" "text") RETURNS "uuid"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
  SELECT CASE WHEN _name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(logo/[^/]+|background/[^/]+|service/[^/]+|staging/[0-9a-f-]{36}/[^/]+/[^/]+)\.(png|jpe?g|webp)$'
    THEN split_part(_name, '/', 1)::uuid END;
$_$;


ALTER FUNCTION "public"."business_visual_asset_business_id"("_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_overdue_business"("p_business_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  target public.businesses%ROWTYPE;
  cancelled_at_value timestamptz := now();
BEGIN
  SELECT * INTO target
  FROM public.businesses
  WHERE id = p_business_id
  FOR UPDATE;

  IF NOT FOUND
     OR target.trial_days IS NOT NULL
     OR target.cancelled_at IS NOT NULL
     OR target.access_until IS NULL
     OR floor(extract(epoch FROM (cancelled_at_value - target.access_until)) / 86400) < 15
  THEN
    RETURN false;
  END IF;

  UPDATE public.businesses
  SET cancelled_at = cancelled_at_value, status = 'cancelado'
  WHERE id = target.id;

  INSERT INTO public.master_business_events(business_id, actor_id, type, title, description)
  VALUES (
    target.id,
    NULL,
    'assinatura',
    'Acesso cancelado por inadimplência (dia 15)',
    'Cancelamento automático por inadimplência, conforme configuração da plataforma.'
  );

  INSERT INTO public.support_messages(business_id, sender, message, read_by_master, read_by_user)
  VALUES (
    target.id,
    'master',
    'O acesso ao painel foi cancelado por inadimplência, conforme a política da plataforma. Regularize a assinatura para solicitar a reativação.',
    true,
    false
  );

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."cancel_overdue_business"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_deposit_pix"("_charge_id" "uuid", "_lease_seconds" integer DEFAULT 60) RETURNS TABLE("acquired" boolean, "reason" "text", "claim_token" "uuid", "lease_expires_at" timestamp with time zone, "attempt_state" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."claim_deposit_pix"("_charge_id" "uuid", "_lease_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_post_service_messages"("p_limit" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "appointment_id" "uuid")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH due AS (
    SELECT q.id
    FROM public.post_service_message_queue q
    WHERE q.processed_at IS NULL
      AND q.scheduled_at <= now()
      AND (q.locked_at IS NULL OR q.locked_at < now() - interval '10 minutes')
    ORDER BY q.scheduled_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  )
  UPDATE public.post_service_message_queue q
  SET locked_at = now()
  FROM due
  WHERE q.id = due.id
  RETURNING q.id, q.appointment_id;
$$;


ALTER FUNCTION "public"."claim_post_service_messages"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_whatsapp_greeting"("p_business_id" "uuid", "p_sender_phone" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  requested_token uuid := gen_random_uuid();
  claimed_token uuid;
BEGIN
  INSERT INTO public.whatsapp_greeting_replies(
    business_id, sender_phone, replied_at, claim_token, claim_expires_at
  ) VALUES (
    p_business_id, p_sender_phone, now() - interval '25 hours', requested_token, now() + interval '5 minutes'
  )
  ON CONFLICT (business_id, sender_phone) DO UPDATE SET
    claim_token = EXCLUDED.claim_token,
    claim_expires_at = EXCLUDED.claim_expires_at
  WHERE whatsapp_greeting_replies.replied_at <= now() - interval '24 hours'
    AND (whatsapp_greeting_replies.claim_expires_at IS NULL OR whatsapp_greeting_replies.claim_expires_at <= now())
  RETURNING claim_token INTO claimed_token;
  RETURN claimed_token;
END;
$$;


ALTER FUNCTION "public"."claim_whatsapp_greeting"("p_business_id" "uuid", "p_sender_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finish_whatsapp_greeting"("p_business_id" "uuid", "p_sender_phone" "text", "p_claim_token" "uuid", "p_sent" boolean) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE affected integer;
BEGIN
  UPDATE public.whatsapp_greeting_replies
  SET replied_at = CASE WHEN p_sent THEN now() ELSE replied_at END,
      claim_token = NULL,
      claim_expires_at = NULL
  WHERE business_id = p_business_id
    AND sender_phone = p_sender_phone
    AND claim_token = p_claim_token;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END;
$$;


ALTER FUNCTION "public"."finish_whatsapp_greeting"("p_business_id" "uuid", "p_sender_phone" "text", "p_claim_token" "uuid", "p_sent" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_business_control_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles r
       WHERE r.user_id = auth.uid() AND r.role = 'super_admin'
     )
     AND (to_jsonb(NEW) - ARRAY['logo_url','brand_background_image','reminder_enabled','reminder_hours_before','theme','pix_mode','pix_exception_clients','withdrawal_pin_hash','withdrawal_pix_key','withdrawal_pix_key_type','updated_at'])
       IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['logo_url','brand_background_image','reminder_enabled','reminder_hours_before','theme','pix_mode','pix_exception_clients','withdrawal_pin_hash','withdrawal_pix_key','withdrawal_pix_key_type','updated_at'])
  THEN
    RAISE EXCEPTION 'business control fields may only be changed by the platform';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."guard_business_control_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ BEGIN INSERT INTO public.profiles (id, full_name, email) VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email) ON CONFLICT (id) DO NOTHING; RETURN NEW; END; $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_business_permission"("_business_id" "uuid", "_permission" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = _business_id AND b.owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.professionals p WHERE p.business_id = _business_id AND p.user_id = auth.uid() AND p.active AND (COALESCE((p.permissions ->> 'admin')::boolean, false) OR COALESCE((p.permissions ->> _permission)::boolean, false))); $$;


ALTER FUNCTION "public"."has_business_permission"("_business_id" "uuid", "_permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role); $$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_business_member"("_business_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = _business_id AND b.owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.professionals p WHERE p.business_id = _business_id AND p.user_id = auth.uid() AND p.active); $$;


ALTER FUNCTION "public"."is_business_member"("_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ledger_adjustment"("_business_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text", "_description" "text") RETURNS TABLE("entry_id" "uuid", "created" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."ledger_adjustment"("_business_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text", "_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ledger_credit_payment"("_business_id" "uuid", "_payment_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text", "_description" "text", "_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("entry_id" "uuid", "created" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."ledger_credit_payment"("_business_id" "uuid", "_payment_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text", "_description" "text", "_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ledger_debit_refund"("_business_id" "uuid", "_payment_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text", "_description" "text") RETURNS TABLE("entry_id" "uuid", "created" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."ledger_debit_refund"("_business_id" "uuid", "_payment_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text", "_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ledger_entries_immutable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  RAISE EXCEPTION 'public.ledger_entries é somente-inserção; % não é permitido em lançamento confirmado', TG_OP;
END;
$$;


ALTER FUNCTION "public"."ledger_entries_immutable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ledger_request_withdrawal"("_business_id" "uuid", "_withdrawal_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text") RETURNS TABLE("entry_id" "uuid", "accepted" boolean, "available_cents" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."ledger_request_withdrawal"("_business_id" "uuid", "_withdrawal_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ledger_reverse_withdrawal"("_business_id" "uuid", "_withdrawal_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text") RETURNS TABLE("entry_id" "uuid", "created" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."ledger_reverse_withdrawal"("_business_id" "uuid", "_withdrawal_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ledger_settle_withdrawal"("_withdrawal_id" "uuid", "_outcome" "text", "_provider_ref" "text" DEFAULT NULL::"text") RETURNS TABLE("changed" boolean, "final_status" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."ledger_settle_withdrawal"("_withdrawal_id" "uuid", "_outcome" "text", "_provider_ref" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_deposit_pix_post_started"("_charge_id" "uuid", "_claim_token" "uuid", "_lease_seconds" integer DEFAULT 60) RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."mark_deposit_pix_post_started"("_charge_id" "uuid", "_claim_token" "uuid", "_lease_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."owns_business"("_business_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = _business_id AND b.owner_id = auth.uid()); $$;


ALTER FUNCTION "public"."owns_business"("_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_auth_failure"("p_key" "text", "p_limit" integer, "p_window_ms" bigint, "p_lock_ms" bigint) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE retry_seconds integer;
BEGIN
  INSERT INTO public.auth_attempts(key, failures, window_started_at, locked_until, updated_at)
  VALUES (
    p_key, 1, now(),
    CASE WHEN p_limit <= 1 THEN now() + (p_lock_ms * interval '1 millisecond') END,
    now()
  )
  ON CONFLICT (key) DO UPDATE SET
    failures = CASE
      WHEN auth_attempts.locked_until > now() THEN auth_attempts.failures
      WHEN auth_attempts.window_started_at + (p_window_ms * interval '1 millisecond') <= now() THEN 1
      ELSE auth_attempts.failures + 1
    END,
    window_started_at = CASE
      WHEN auth_attempts.locked_until > now() THEN auth_attempts.window_started_at
      WHEN auth_attempts.window_started_at + (p_window_ms * interval '1 millisecond') <= now() THEN now()
      ELSE auth_attempts.window_started_at
    END,
    locked_until = CASE
      WHEN auth_attempts.locked_until > now() THEN auth_attempts.locked_until
      WHEN (CASE WHEN auth_attempts.window_started_at + (p_window_ms * interval '1 millisecond') <= now() THEN 1 ELSE auth_attempts.failures + 1 END) >= p_limit
        THEN now() + (p_lock_ms * interval '1 millisecond')
      ELSE NULL
    END,
    updated_at = now();
  SELECT GREATEST(0, CEIL(EXTRACT(EPOCH FROM (locked_until - now())))::integer)
    INTO retry_seconds FROM public.auth_attempts WHERE key = p_key;
  RETURN COALESCE(retry_seconds, 0);
END;
$$;


ALTER FUNCTION "public"."register_auth_failure"("p_key" "text", "p_limit" integer, "p_window_ms" bigint, "p_lock_ms" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_deposit_pix"("_charge_id" "uuid", "_claim_token" "uuid", "_outcome" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."release_deposit_pix"("_charge_id" "uuid", "_claim_token" "uuid", "_outcome" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_professional_services"("_business_id" "uuid", "_professional_id" "uuid", "_service_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."replace_professional_services"("_business_id" "uuid", "_professional_id" "uuid", "_service_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_business_visual_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_business_visual_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_business_whatsapp_credentials_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."touch_business_whatsapp_credentials_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agpay_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dedupe_hash" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "transaction_uuid" "text",
    "payload" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "available_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "locked_at" timestamp with time zone,
    "processed_at" timestamp with time zone,
    "last_error" "text",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agpay_webhook_events_attempts_check" CHECK (("attempts" >= 0)),
    CONSTRAINT "agpay_webhook_events_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'done'::"text", 'failed'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."agpay_webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "professional_id" "uuid",
    "service_id" "uuid",
    "customer_id" "uuid",
    "customer_name" "text" NOT NULL,
    "customer_phone" "text",
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'agendado'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deposit_cents" integer DEFAULT 0 NOT NULL,
    "deposit_paid_at" timestamp with time zone,
    "public_code" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asaas_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "account_id" "text",
    "payment_id" "text",
    "payload" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "available_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "locked_at" timestamp with time zone,
    "processed_at" timestamp with time zone,
    "last_error" "text",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "asaas_webhook_events_attempts_check" CHECK (("attempts" >= 0)),
    CONSTRAINT "asaas_webhook_events_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'done'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."asaas_webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auth_attempts" (
    "key" "text" NOT NULL,
    "failures" integer DEFAULT 0 NOT NULL,
    "window_started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "locked_until" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."auth_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."broadcasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "audiences" "text"[],
    "display_days" integer,
    "accent_color" "text",
    "icon" "text"
);


ALTER TABLE "public"."broadcasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "weekday" smallint NOT NULL,
    "starts_at" time without time zone DEFAULT '08:30:00'::time without time zone NOT NULL,
    "ends_at" time without time zone DEFAULT '19:00:00'::time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_hours_weekday_check" CHECK ((("weekday" >= 0) AND ("weekday" <= 6)))
);


ALTER TABLE "public"."business_hours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_outreach_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "design" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."business_outreach_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_visual_settings" (
    "business_id" "uuid" NOT NULL,
    "schema_version" integer DEFAULT 2 NOT NULL,
    "revision" bigint DEFAULT 1 NOT NULL,
    "layout_key" "text" DEFAULT 'classic'::"text" NOT NULL,
    "niche_id" "text" DEFAULT 'outro'::"text" NOT NULL,
    "palette_id" "text",
    "appearance" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_visual_settings_layout_key_check" CHECK (("layout_key" = ANY (ARRAY['classic'::"text", 'elegance'::"text"]))),
    CONSTRAINT "business_visual_settings_revision_check" CHECK (("revision" > 0)),
    CONSTRAINT "business_visual_settings_schema_version_check" CHECK (("schema_version" > 0))
);


ALTER TABLE "public"."business_visual_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_whatsapp_credentials" (
    "business_id" "uuid" NOT NULL,
    "instance_id" "text" NOT NULL,
    "instance_token" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."business_whatsapp_credentials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."businesses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "category" "text" DEFAULT 'outro'::"text" NOT NULL,
    "phone" "text",
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'ativo'::"text" NOT NULL,
    "monthly_fee_cents" integer DEFAULT 8990 NOT NULL,
    "brand_primary" "text",
    "brand_background" "text",
    "reminder_enabled" boolean DEFAULT false NOT NULL,
    "reminder_hours_before" integer DEFAULT 24 NOT NULL,
    "reminder_channel" "text" DEFAULT 'whatsapp'::"text" NOT NULL,
    "reminder_template" "text",
    "whatsapp_instance" "text",
    "whatsapp_status" "text" DEFAULT 'desconectado'::"text" NOT NULL,
    "confirmation_template" "text",
    "logo_url" "text",
    "agpay_commission_percent" numeric(5,2) DEFAULT 0 NOT NULL,
    "withdrawal_pix_key" "text",
    "withdrawal_pix_key_type" "text",
    "agpay_split_email" "text",
    "agpay_split_status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "payment_confirmation_template" "text",
    "selected_outreach_template_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "whatsapp_instance_id" "text",
    "whatsapp_instance_token" "text",
    "greeting" "text",
    "timezone" "text" DEFAULT 'America/Sao_Paulo'::"text" NOT NULL,
    "brand_background_image" "text",
    "trial_days" integer,
    "trial_registration_name" "text",
    "trial_created_at" timestamp with time zone,
    "saudacao_template" "text",
    "withdrawal_pin_hash" "text",
    "pix_mode" "text" DEFAULT 'opcional'::"text" NOT NULL,
    "pix_exception_clients" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "agpay_auto_first_key" boolean DEFAULT false NOT NULL,
    "theme" "text" DEFAULT 'azul'::"text",
    "lead_source" "text",
    "sales_owner" "text",
    "commercial_notes" "text",
    "sdr_id" "uuid",
    "cancel_requested_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "access_until" timestamp with time zone,
    "agpay_access_blocked" boolean DEFAULT false NOT NULL,
    "agpay_withdrawal_blocked" boolean DEFAULT false NOT NULL,
    "coupon_code" "text",
    "coupon_percent" integer,
    "coupon_expires_at" timestamp with time zone,
    "owner_cpf" "text",
    CONSTRAINT "businesses_agpay_commission_percent_check" CHECK ((("agpay_commission_percent" >= (0)::numeric) AND ("agpay_commission_percent" < (100)::numeric))),
    CONSTRAINT "businesses_agpay_split_status_check" CHECK (("agpay_split_status" = ANY (ARRAY['pendente'::"text", 'aprovada'::"text", 'bloqueada'::"text"]))),
    CONSTRAINT "businesses_greeting_length_check" CHECK ((("greeting" IS NULL) OR ("char_length"("greeting") <= 500))),
    CONSTRAINT "businesses_timezone_length_check" CHECK (("char_length"("timezone") <= 64)),
    CONSTRAINT "businesses_withdrawal_pix_key_type_check" CHECK (("withdrawal_pix_key_type" = ANY (ARRAY['cpf'::"text", 'cnpj'::"text", 'email'::"text", 'telefone'::"text", 'aleatoria'::"text"])))
);


ALTER TABLE "public"."businesses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."businesses"."agpay_commission_percent" IS 'Percentual da cobrança retido como comissão da plataforma; o restante é enviado ao split do estabelecimento.';



COMMENT ON COLUMN "public"."businesses"."agpay_split_status" IS 'pendente | aprovada | bloqueada';



COMMENT ON COLUMN "public"."businesses"."brand_background_image" IS 'Caminho no bucket business-logos (kind "background") usado como imagem de fundo do Painel 1 público; null usa brand_background (cor sólida).';



CREATE TABLE IF NOT EXISTS "public"."client_error_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kind" "text" NOT NULL,
    "message" "text" NOT NULL,
    "source" "text" NOT NULL,
    "detail" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "business_id" "uuid",
    "user_id" "uuid",
    "app_version" "text",
    CONSTRAINT "client_error_log_app_version_check" CHECK (("length"("app_version") <= 120)),
    CONSTRAINT "client_error_log_detail_check" CHECK (("octet_length"(("detail")::"text") <= 16000)),
    CONSTRAINT "client_error_log_kind_check" CHECK (("kind" = ANY (ARRAY['ui_error'::"text", 'unhandled_rejection'::"text", 'request_failed'::"text"]))),
    CONSTRAINT "client_error_log_message_check" CHECK (("length"("message") <= 2000)),
    CONSTRAINT "client_error_log_source_check" CHECK (("length"("source") <= 500))
);


ALTER TABLE "public"."client_error_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "birth_date" "date",
    "cpf" "text",
    "cnpj" "text"
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deposit_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "appointment_id" "uuid",
    "provider" "text" DEFAULT 'agpay'::"text" NOT NULL,
    "provider_payment_id" "text",
    "amount_cents" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "qr_code" "text",
    "qr_code_base64" "text",
    "ticket_url" "text",
    "payer_name" "text",
    "payer_phone" "text",
    "expires_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payer_cpf_cnpj" "text",
    "provider_status" "text",
    "provider_deleted_at" timestamp with time zone,
    "pix_attempt_state" "text" DEFAULT 'nao_tentado'::"text" NOT NULL,
    "pix_claim_token" "uuid",
    "pix_claim_expires_at" timestamp with time zone,
    "pix_post_started_at" timestamp with time zone,
    "pix_attempts" integer DEFAULT 0 NOT NULL,
    "payer_email" "text",
    "gateway_fee_cents" integer,
    "platform_commission_percent_snapshot" numeric(5,2),
    "platform_commission_flat_cents" integer,
    "platform_commission_cents" integer,
    "net_amount_cents" integer,
    CONSTRAINT "deposit_payments_pix_attempt_state_check" CHECK (("pix_attempt_state" = ANY (ARRAY['nao_tentado'::"text", 'post_enviado'::"text", 'post_incerto'::"text", 'criado'::"text", 'rejeitado'::"text"]))),
    CONSTRAINT "deposit_payments_pix_attempts_check" CHECK (("pix_attempts" >= 0)),
    CONSTRAINT "deposit_payments_pix_claim_pair_check" CHECK ((("pix_claim_token" IS NULL) = ("pix_claim_expires_at" IS NULL))),
    CONSTRAINT "deposit_payments_pix_created_has_payment_check" CHECK ((("pix_attempt_state" <> 'criado'::"text") OR ("provider_payment_id" IS NOT NULL)))
);


ALTER TABLE "public"."deposit_payments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."deposit_payments"."pix_attempt_state" IS 'nao_tentado | post_enviado | post_incerto | criado — ver migration deposit_pix_retry';



COMMENT ON COLUMN "public"."deposit_payments"."pix_claim_token" IS 'Token do detentor atual do claim de geração Pix; NULL quando livre.';



COMMENT ON COLUMN "public"."deposit_payments"."net_amount_cents" IS 'amount_cents - gateway_fee_cents - platform_commission_cents, congelado no momento da confirmação (nunca recalculado).';



CREATE TABLE IF NOT EXISTS "public"."ledger_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "amount_cents" integer NOT NULL,
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "payment_id" "uuid",
    "withdrawal_id" "uuid",
    "idempotency_key" "text" NOT NULL,
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ledger_entries_amount_cents_check" CHECK (("amount_cents" <> 0)),
    CONSTRAINT "ledger_entries_status_check" CHECK (("status" = 'completed'::"text")),
    CONSTRAINT "ledger_entries_type_check" CHECK (("type" = ANY (ARRAY['payment_credit'::"text", 'withdrawal_debit'::"text", 'withdrawal_reversal'::"text", 'refund_debit'::"text", 'adjustment'::"text"])))
);


ALTER TABLE "public"."ledger_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."ledger_entries" IS 'Razão contábil imutável. Nunca UPDATE/DELETE — correções são novos lançamentos (adjustment).';



CREATE TABLE IF NOT EXISTS "public"."master_business_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "master_business_events_description_check" CHECK ((("description" IS NULL) OR ("char_length"("description") <= 2000))),
    CONSTRAINT "master_business_events_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 200))),
    CONSTRAINT "master_business_events_type_check" CHECK (("type" = ANY (ARRAY['cadastro'::"text", 'observacao'::"text", 'perfil'::"text", 'comercial'::"text", 'assinatura'::"text", 'pagamento'::"text", 'suporte'::"text", 'suspensao'::"text", 'reativacao'::"text", 'security'::"text", 'edicao_ficha'::"text", 'troca_senha_dono'::"text"])))
);


ALTER TABLE "public"."master_business_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."master_business_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "body" "text" NOT NULL,
    "next_step" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "master_business_notes_body_check" CHECK ((("char_length"("body") >= 1) AND ("char_length"("body") <= 4000))),
    CONSTRAINT "master_business_notes_next_step_check" CHECK ((("next_step" IS NULL) OR ("char_length"("next_step") <= 500)))
);


ALTER TABLE "public"."master_business_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."master_impersonation_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "master_user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."master_impersonation_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outreach_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "usage_type" "text" NOT NULL,
    "body" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "design" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    CONSTRAINT "outreach_templates_body_check" CHECK ((("char_length"("body") >= 1) AND ("char_length"("body") <= 2000))),
    CONSTRAINT "outreach_templates_title_check" CHECK ((("char_length"("title") >= 2) AND ("char_length"("title") <= 80))),
    CONSTRAINT "outreach_templates_usage_type_check" CHECK (("usage_type" = ANY (ARRAY['story'::"text", 'whatsapp'::"text", 'outro'::"text"])))
);


ALTER TABLE "public"."outreach_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pix_key_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "key_type" "text" NOT NULL,
    "key" "text" NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved_by" "uuid",
    "decided_at" timestamp with time zone,
    CONSTRAINT "pix_key_approvals_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'aprovado'::"text", 'recusado'::"text"])))
);


ALTER TABLE "public"."pix_key_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_service_message_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "processed_at" timestamp with time zone,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "locked_at" timestamp with time zone
);


ALTER TABLE "public"."post_service_message_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."professionals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "role" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "phone" "text",
    "email" "text",
    "avatar_path" "text",
    "working_days" smallint[] DEFAULT ARRAY[(1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint] NOT NULL,
    "permissions" "jsonb" DEFAULT '{"admin": false, "sell_product": false, "view_product": false, "block_schedule": false, "generate_qrcode": false, "manage_outreach": false, "manage_appearance": false, "cancel_appointment": false, "create_appointment": false, "reopen_appointment": false, "view_customer_phone": false, "complete_appointment": false, "receive_notification": false}'::"jsonb" NOT NULL,
    "agenda_name" "text",
    "public_name" "text"
);


ALTER TABLE "public"."professionals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reminder_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "phone" "text",
    "channel" "text" DEFAULT 'whatsapp'::"text" NOT NULL,
    "status" "text" DEFAULT 'enviado'::"text" NOT NULL,
    "error" "text",
    "provider_sid" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reminder_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sdr_config" (
    "id" boolean DEFAULT true NOT NULL,
    "secret" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    CONSTRAINT "sdr_config_id_check" CHECK ("id")
);


ALTER TABLE "public"."sdr_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sdr_ideas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sdr_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "details" "text" DEFAULT ''::"text" NOT NULL,
    "created_by" "text" DEFAULT 'master'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sdr_ideas_created_by_check" CHECK (("created_by" = ANY (ARRAY['master'::"text", 'sdr'::"text"])))
);


ALTER TABLE "public"."sdr_ideas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sdrs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "pin" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "signup_goal" integer DEFAULT 0 NOT NULL,
    "sales_goal" integer DEFAULT 0 NOT NULL,
    "commission_cents" integer DEFAULT 5000 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "preset_scripts" "text" DEFAULT ''::"text" NOT NULL,
    "script_notes" "text" DEFAULT ''::"text" NOT NULL
);


ALTER TABLE "public"."sdrs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_professionals" (
    "service_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "business_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_professionals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "duration_minutes" integer DEFAULT 30 NOT NULL,
    "price_cents" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "deposit_cents" integer DEFAULT 0 NOT NULL,
    "is_combo" boolean DEFAULT false NOT NULL,
    "show_price" boolean DEFAULT true NOT NULL,
    "show_duration" boolean DEFAULT true NOT NULL,
    "show_service" boolean DEFAULT true NOT NULL,
    "image_path" "text",
    "requires_deposit" boolean DEFAULT true NOT NULL,
    "deposit_mode" "text" DEFAULT 'fixed'::"text" NOT NULL,
    "deposit_percent_bps" integer DEFAULT 0 NOT NULL,
    "category_id" "uuid",
    "available_days" smallint[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6] NOT NULL,
    CONSTRAINT "services_deposit_cents_nonnegative" CHECK (("deposit_cents" >= 0)),
    CONSTRAINT "services_deposit_mode_check" CHECK (("deposit_mode" = ANY (ARRAY['fixed'::"text", 'percent'::"text"]))),
    CONSTRAINT "services_deposit_percent_bps_check" CHECK ((("deposit_percent_bps" >= 0) AND ("deposit_percent_bps" <= 10000))),
    CONSTRAINT "services_price_cents_nonnegative" CHECK (("price_cents" >= 0))
);


ALTER TABLE "public"."services" OWNER TO "postgres";


COMMENT ON COLUMN "public"."services"."deposit_mode" IS 'fixed (usa deposit_cents) | percent (usa deposit_percent_bps sobre price_cents)';



COMMENT ON COLUMN "public"."services"."deposit_percent_bps" IS 'Percentual do sinal em pontos-base (0..10000); usado quando deposit_mode = percent.';



CREATE TABLE IF NOT EXISTS "public"."subscription_charges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "method" "text" DEFAULT 'pix'::"text" NOT NULL,
    "provider" "text" DEFAULT 'agpay'::"text" NOT NULL,
    "provider_payment_id" "text",
    "amount_cents" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "period_start" timestamp with time zone,
    "period_end" timestamp with time zone,
    "payer_cpf" "text",
    "payer_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paid_at" timestamp with time zone,
    CONSTRAINT "subscription_charges_amount_cents_check" CHECK (("amount_cents" >= 0)),
    CONSTRAINT "subscription_charges_method_check" CHECK (("method" = ANY (ARRAY['pix'::"text", 'card'::"text"]))),
    CONSTRAINT "subscription_charges_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."subscription_charges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_lifecycle_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "started_at" timestamp with time zone NOT NULL,
    "completed_at" timestamp with time zone NOT NULL,
    "elapsed_ms" integer NOT NULL,
    "businesses_scanned" integer DEFAULT 0 NOT NULL,
    "notices_created" integer DEFAULT 0 NOT NULL,
    "cancellations_created" integer DEFAULT 0 NOT NULL,
    "auth_attempts_cleaned" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."subscription_lifecycle_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "reference_month" "date" NOT NULL,
    "amount_cents" integer DEFAULT 8990 NOT NULL,
    "status" "text" DEFAULT 'pago'::"text" NOT NULL,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscription_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "sender" "text" NOT NULL,
    "message" "text" NOT NULL,
    "read_by_master" boolean DEFAULT true NOT NULL,
    "read_by_user" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "support_messages_message_check" CHECK ((("char_length"("message") >= 1) AND ("char_length"("message") <= 1000))),
    CONSTRAINT "support_messages_sender_check" CHECK (("sender" = ANY (ARRAY['user'::"text", 'master'::"text"])))
);


ALTER TABLE "public"."support_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "professional_id" "uuid",
    "recurring" boolean DEFAULT true NOT NULL,
    "weekday" smallint,
    "block_date" "date",
    "starts_at" time without time zone NOT NULL,
    "ends_at" time without time zone NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "time_blocks_weekday_check" CHECK ((("weekday" >= 0) AND ("weekday" <= 6)))
);


ALTER TABLE "public"."time_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallets" (
    "business_id" "uuid" NOT NULL,
    "available_cents" integer DEFAULT 0 NOT NULL,
    "pending_cents" integer DEFAULT 0 NOT NULL,
    "locked_cents" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wallets_locked_cents_check" CHECK (("locked_cents" >= 0))
);


ALTER TABLE "public"."wallets" OWNER TO "postgres";


COMMENT ON TABLE "public"."wallets" IS 'Projeção do saldo por estabelecimento. Só escrita dentro das funções ledger_*, nunca diretamente — available_cents pode ficar negativo (estorno pós-saque, FR-014).';



CREATE TABLE IF NOT EXISTS "public"."whatsapp_greeting_replies" (
    "business_id" "uuid" NOT NULL,
    "sender_phone" "text" NOT NULL,
    "replied_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "claim_token" "uuid",
    "claim_expires_at" timestamp with time zone
);


ALTER TABLE "public"."whatsapp_greeting_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."withdrawals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "amount_cents" integer NOT NULL,
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "pix_key_snapshot" "text" NOT NULL,
    "provider_ref" "text",
    "provider_fee_cents" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "platform_fee_cents" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "withdrawals_amount_cents_check" CHECK (("amount_cents" >= 1000)),
    CONSTRAINT "withdrawals_platform_fee_cents_check" CHECK (("platform_fee_cents" >= 0)),
    CONSTRAINT "withdrawals_provider_fee_cents_check" CHECK ((("provider_fee_cents" IS NULL) OR ("provider_fee_cents" >= 0))),
    CONSTRAINT "withdrawals_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'processing'::"text", 'paid'::"text", 'failed'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."withdrawals" OWNER TO "postgres";


ALTER TABLE ONLY "public"."agpay_webhook_events"
    ADD CONSTRAINT "agpay_webhook_events_dedupe_hash_key" UNIQUE ("dedupe_hash");



ALTER TABLE ONLY "public"."agpay_webhook_events"
    ADD CONSTRAINT "agpay_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_no_overlap_per_professional" EXCLUDE USING "gist" ("professional_id" WITH =, "tstzrange"("starts_at", "ends_at") WITH &&) WHERE ((("professional_id" IS NOT NULL) AND ("status" <> ALL (ARRAY['cancelado'::"text", 'aguardando_sinal'::"text"]))));



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asaas_webhook_events"
    ADD CONSTRAINT "asaas_webhook_events_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."asaas_webhook_events"
    ADD CONSTRAINT "asaas_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_attempts"
    ADD CONSTRAINT "auth_attempts_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."broadcasts"
    ADD CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_hours"
    ADD CONSTRAINT "business_hours_business_id_weekday_key" UNIQUE ("business_id", "weekday");



ALTER TABLE ONLY "public"."business_hours"
    ADD CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_outreach_overrides"
    ADD CONSTRAINT "business_outreach_overrides_business_template_key" UNIQUE ("business_id", "template_id");



ALTER TABLE ONLY "public"."business_outreach_overrides"
    ADD CONSTRAINT "business_outreach_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_visual_settings"
    ADD CONSTRAINT "business_visual_settings_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."business_whatsapp_credentials"
    ADD CONSTRAINT "business_whatsapp_credentials_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."client_error_log"
    ADD CONSTRAINT "client_error_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deposit_payments"
    ADD CONSTRAINT "deposit_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ledger_entries"
    ADD CONSTRAINT "ledger_entries_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."ledger_entries"
    ADD CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."master_business_events"
    ADD CONSTRAINT "master_business_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."master_business_notes"
    ADD CONSTRAINT "master_business_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."master_impersonation_sessions"
    ADD CONSTRAINT "master_impersonation_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."master_impersonation_sessions"
    ADD CONSTRAINT "master_impersonation_sessions_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."outreach_templates"
    ADD CONSTRAINT "outreach_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pix_key_approvals"
    ADD CONSTRAINT "pix_key_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."post_service_message_queue"
    ADD CONSTRAINT "post_service_message_queue_appointment_id_key" UNIQUE ("appointment_id");



ALTER TABLE ONLY "public"."post_service_message_queue"
    ADD CONSTRAINT "post_service_message_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reminder_logs"
    ADD CONSTRAINT "reminder_logs_appointment_id_channel_key" UNIQUE ("appointment_id", "channel");



ALTER TABLE ONLY "public"."reminder_logs"
    ADD CONSTRAINT "reminder_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sdr_config"
    ADD CONSTRAINT "sdr_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sdr_ideas"
    ADD CONSTRAINT "sdr_ideas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sdrs"
    ADD CONSTRAINT "sdrs_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."sdrs"
    ADD CONSTRAINT "sdrs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_professionals"
    ADD CONSTRAINT "service_professionals_pkey" PRIMARY KEY ("service_id", "professional_id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_charges"
    ADD CONSTRAINT "subscription_charges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_charges"
    ADD CONSTRAINT "subscription_charges_provider_payment_id_key" UNIQUE ("provider_payment_id");



ALTER TABLE ONLY "public"."subscription_lifecycle_runs"
    ADD CONSTRAINT "subscription_lifecycle_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_payments"
    ADD CONSTRAINT "subscription_payments_business_id_reference_month_key" UNIQUE ("business_id", "reference_month");



ALTER TABLE ONLY "public"."subscription_payments"
    ADD CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_blocks"
    ADD CONSTRAINT "time_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."whatsapp_greeting_replies"
    ADD CONSTRAINT "whatsapp_greeting_replies_pkey" PRIMARY KEY ("business_id", "sender_phone");



ALTER TABLE ONLY "public"."withdrawals"
    ADD CONSTRAINT "withdrawals_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."withdrawals"
    ADD CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id");



CREATE INDEX "agpay_webhook_events_pending_idx" ON "public"."agpay_webhook_events" USING "btree" ("status", "available_at", "received_at");



CREATE INDEX "agpay_webhook_events_transaction_idx" ON "public"."agpay_webhook_events" USING "btree" ("transaction_uuid", "received_at" DESC);



CREATE INDEX "appointments_business_start_idx" ON "public"."appointments" USING "btree" ("business_id", "starts_at");



CREATE UNIQUE INDEX "appointments_public_code_uidx" ON "public"."appointments" USING "btree" ("public_code");



CREATE INDEX "asaas_webhook_events_payment_idx" ON "public"."asaas_webhook_events" USING "btree" ("payment_id", "received_at" DESC);



CREATE INDEX "asaas_webhook_events_pending_idx" ON "public"."asaas_webhook_events" USING "btree" ("status", "available_at", "received_at");



CREATE INDEX "business_outreach_overrides_business_idx" ON "public"."business_outreach_overrides" USING "btree" ("business_id");



CREATE INDEX "business_visual_settings_updated_at_idx" ON "public"."business_visual_settings" USING "btree" ("updated_at" DESC);



CREATE INDEX "businesses_sdr_id_idx" ON "public"."businesses" USING "btree" ("sdr_id");



CREATE INDEX "client_error_log_business_idx" ON "public"."client_error_log" USING "btree" ("business_id");



CREATE INDEX "client_error_log_kind_occurred_idx" ON "public"."client_error_log" USING "btree" ("kind", "occurred_at" DESC);



CREATE INDEX "client_error_log_occurred_idx" ON "public"."client_error_log" USING "btree" ("occurred_at" DESC, "id" DESC);



CREATE INDEX "client_error_log_user_idx" ON "public"."client_error_log" USING "btree" ("user_id");



CREATE INDEX "deposit_payments_business_idx" ON "public"."deposit_payments" USING "btree" ("business_id", "created_at" DESC);



CREATE INDEX "deposit_payments_provider_payment_id_idx" ON "public"."deposit_payments" USING "btree" ("provider_payment_id");



CREATE UNIQUE INDEX "deposit_payments_provider_payment_unique" ON "public"."deposit_payments" USING "btree" ("provider", "provider_payment_id") WHERE ("provider_payment_id" IS NOT NULL);



CREATE INDEX "ledger_entries_business_created_idx" ON "public"."ledger_entries" USING "btree" ("business_id", "created_at" DESC);



CREATE INDEX "ledger_entries_payment_idx" ON "public"."ledger_entries" USING "btree" ("payment_id") WHERE ("payment_id" IS NOT NULL);



CREATE INDEX "ledger_entries_withdrawal_idx" ON "public"."ledger_entries" USING "btree" ("withdrawal_id") WHERE ("withdrawal_id" IS NOT NULL);



CREATE INDEX "master_business_events_business_created_idx" ON "public"."master_business_events" USING "btree" ("business_id", "created_at" DESC);



CREATE INDEX "master_business_notes_business_created_idx" ON "public"."master_business_notes" USING "btree" ("business_id", "created_at" DESC);



CREATE INDEX "master_impersonation_sessions_token_idx" ON "public"."master_impersonation_sessions" USING "btree" ("token");



CREATE INDEX "professionals_user_idx" ON "public"."professionals" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "reminder_logs_business_idx" ON "public"."reminder_logs" USING "btree" ("business_id", "created_at" DESC);



CREATE INDEX "service_categories_business_idx" ON "public"."service_categories" USING "btree" ("business_id");



CREATE INDEX "service_professionals_business_idx" ON "public"."service_professionals" USING "btree" ("business_id");



CREATE INDEX "services_category_idx" ON "public"."services" USING "btree" ("category_id") WHERE ("category_id" IS NOT NULL);



CREATE INDEX "subscription_charges_business_created_idx" ON "public"."subscription_charges" USING "btree" ("business_id", "created_at" DESC);



CREATE INDEX "support_messages_business_created" ON "public"."support_messages" USING "btree" ("business_id", "created_at");



CREATE INDEX "withdrawals_business_created_idx" ON "public"."withdrawals" USING "btree" ("business_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "agpay_webhook_events_updated" BEFORE UPDATE ON "public"."agpay_webhook_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "appointments_updated" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "asaas_webhook_events_updated" BEFORE UPDATE ON "public"."asaas_webhook_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "business_hours_updated" BEFORE UPDATE ON "public"."business_hours" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "business_visual_settings_touch_updated_at" BEFORE UPDATE ON "public"."business_visual_settings" FOR EACH ROW EXECUTE FUNCTION "public"."touch_business_visual_settings_updated_at"();



CREATE OR REPLACE TRIGGER "business_whatsapp_credentials_touch_updated_at" BEFORE UPDATE ON "public"."business_whatsapp_credentials" FOR EACH ROW EXECUTE FUNCTION "public"."touch_business_whatsapp_credentials_updated_at"();



CREATE OR REPLACE TRIGGER "businesses_guard_control_columns" BEFORE UPDATE ON "public"."businesses" FOR EACH ROW EXECUTE FUNCTION "public"."guard_business_control_columns"();



CREATE OR REPLACE TRIGGER "businesses_updated" BEFORE UPDATE ON "public"."businesses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "customers_updated" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "deposit_payments_updated" BEFORE UPDATE ON "public"."deposit_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "ledger_entries_no_delete" BEFORE DELETE ON "public"."ledger_entries" FOR EACH ROW EXECUTE FUNCTION "public"."ledger_entries_immutable"();



CREATE OR REPLACE TRIGGER "ledger_entries_no_update" BEFORE UPDATE ON "public"."ledger_entries" FOR EACH ROW EXECUTE FUNCTION "public"."ledger_entries_immutable"();



CREATE OR REPLACE TRIGGER "outreach_templates_updated" BEFORE UPDATE ON "public"."outreach_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "professionals_updated" BEFORE UPDATE ON "public"."professionals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "services_updated" BEFORE UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "subscription_payments_updated" BEFORE UPDATE ON "public"."subscription_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "time_blocks_updated" BEFORE UPDATE ON "public"."time_blocks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "wallets_updated" BEFORE UPDATE ON "public"."wallets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_hours"
    ADD CONSTRAINT "business_hours_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_outreach_overrides"
    ADD CONSTRAINT "business_outreach_overrides_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_outreach_overrides"
    ADD CONSTRAINT "business_outreach_overrides_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."outreach_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_visual_settings"
    ADD CONSTRAINT "business_visual_settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_visual_settings"
    ADD CONSTRAINT "business_visual_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_whatsapp_credentials"
    ADD CONSTRAINT "business_whatsapp_credentials_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_sdr_id_fkey" FOREIGN KEY ("sdr_id") REFERENCES "public"."sdrs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_error_log"
    ADD CONSTRAINT "client_error_log_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_error_log"
    ADD CONSTRAINT "client_error_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deposit_payments"
    ADD CONSTRAINT "deposit_payments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deposit_payments"
    ADD CONSTRAINT "deposit_payments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ledger_entries"
    ADD CONSTRAINT "ledger_entries_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ledger_entries"
    ADD CONSTRAINT "ledger_entries_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."deposit_payments"("id");



ALTER TABLE ONLY "public"."ledger_entries"
    ADD CONSTRAINT "ledger_entries_withdrawal_id_fkey" FOREIGN KEY ("withdrawal_id") REFERENCES "public"."withdrawals"("id");



ALTER TABLE ONLY "public"."master_business_events"
    ADD CONSTRAINT "master_business_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."master_business_events"
    ADD CONSTRAINT "master_business_events_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."master_business_notes"
    ADD CONSTRAINT "master_business_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."master_business_notes"
    ADD CONSTRAINT "master_business_notes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."master_impersonation_sessions"
    ADD CONSTRAINT "master_impersonation_sessions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."master_impersonation_sessions"
    ADD CONSTRAINT "master_impersonation_sessions_master_user_id_fkey" FOREIGN KEY ("master_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outreach_templates"
    ADD CONSTRAINT "outreach_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pix_key_approvals"
    ADD CONSTRAINT "pix_key_approvals_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_service_message_queue"
    ADD CONSTRAINT "post_service_message_queue_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reminder_logs"
    ADD CONSTRAINT "reminder_logs_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reminder_logs"
    ADD CONSTRAINT "reminder_logs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sdr_ideas"
    ADD CONSTRAINT "sdr_ideas_sdr_id_fkey" FOREIGN KEY ("sdr_id") REFERENCES "public"."sdrs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_professionals"
    ADD CONSTRAINT "service_professionals_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_professionals"
    ADD CONSTRAINT "service_professionals_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_professionals"
    ADD CONSTRAINT "service_professionals_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscription_charges"
    ADD CONSTRAINT "subscription_charges_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_payments"
    ADD CONSTRAINT "subscription_payments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_blocks"
    ADD CONSTRAINT "time_blocks_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_blocks"
    ADD CONSTRAINT "time_blocks_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_greeting_replies"
    ADD CONSTRAINT "whatsapp_greeting_replies_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."withdrawals"
    ADD CONSTRAINT "withdrawals_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



CREATE POLICY "Owners can read own ledger entries" ON "public"."ledger_entries" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "ledger_entries"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can read own subscription charges" ON "public"."subscription_charges" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "subscription_charges"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can read own wallet" ON "public"."wallets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "wallets"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can read own withdrawals" ON "public"."withdrawals" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "withdrawals"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."agpay_webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointments_owner" ON "public"."appointments" TO "authenticated" USING ("public"."owns_business"("business_id")) WITH CHECK ("public"."owns_business"("business_id"));



CREATE POLICY "appointments_professional_create" ON "public"."appointments" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_business_permission"("business_id", 'create_appointment'::"text"));



CREATE POLICY "appointments_professional_read" ON "public"."appointments" FOR SELECT TO "authenticated" USING ("public"."is_business_member"("business_id"));



ALTER TABLE "public"."asaas_webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated reads broadcasts" ON "public"."broadcasts" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."broadcasts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_hours" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_hours_owner" ON "public"."business_hours" TO "authenticated" USING ("public"."owns_business"("business_id")) WITH CHECK ("public"."owns_business"("business_id"));



CREATE POLICY "business_hours_professional_read" ON "public"."business_hours" FOR SELECT TO "authenticated" USING ("public"."is_business_member"("business_id"));



CREATE POLICY "business_hours_public_read" ON "public"."business_hours" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."business_outreach_overrides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_outreach_overrides_owner_all" ON "public"."business_outreach_overrides" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "business_outreach_overrides"."business_id") AND ("b"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "business_outreach_overrides"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."business_visual_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_visual_settings_appearance_manage" ON "public"."business_visual_settings" TO "authenticated" USING ("public"."has_business_permission"("business_id", 'manage_appearance'::"text")) WITH CHECK ("public"."has_business_permission"("business_id", 'manage_appearance'::"text"));



CREATE POLICY "business_visual_settings_member_read" ON "public"."business_visual_settings" FOR SELECT TO "authenticated" USING ("public"."is_business_member"("business_id"));



ALTER TABLE "public"."business_whatsapp_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."businesses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "businesses_own" ON "public"."businesses" TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "businesses_professional_read" ON "public"."businesses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."business_id" = "businesses"."id") AND ("p"."user_id" = "auth"."uid"()) AND "p"."active"))));



CREATE POLICY "businesses_public_read" ON "public"."businesses" FOR SELECT TO "anon" USING (true);



CREATE POLICY "businesses_super_admin" ON "public"."businesses" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



ALTER TABLE "public"."client_error_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_error_log_insert" ON "public"."client_error_log" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("business_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "client_error_log"."business_id") AND ("b"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."business_id" = "client_error_log"."business_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "client_error_log_select" ON "public"."client_error_log" FOR SELECT TO "authenticated" USING ("public"."has_role"(( SELECT "auth"."uid"() AS "uid"), 'super_admin'::"public"."app_role"));



ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customers_owner" ON "public"."customers" TO "authenticated" USING ("public"."owns_business"("business_id")) WITH CHECK ("public"."owns_business"("business_id"));



CREATE POLICY "customers_professional_read" ON "public"."customers" FOR SELECT TO "authenticated" USING ("public"."is_business_member"("business_id"));



ALTER TABLE "public"."deposit_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ledger_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."master_business_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "master_business_events_super_admin" ON "public"."master_business_events" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



ALTER TABLE "public"."master_business_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "master_business_notes_super_admin" ON "public"."master_business_notes" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



ALTER TABLE "public"."master_impersonation_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outreach_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "outreach_templates_business_read" ON "public"."outreach_templates" FOR SELECT TO "authenticated" USING ((("active" = true) AND (EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE ("b"."owner_id" = "auth"."uid"())))));



CREATE POLICY "outreach_templates_super_admin_all" ON "public"."outreach_templates" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "owner reads own business pix approvals" ON "public"."pix_key_approvals" FOR SELECT USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



ALTER TABLE "public"."pix_key_approvals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pix_key_approvals_owner_insert" ON "public"."pix_key_approvals" FOR INSERT TO "authenticated" WITH CHECK (("public"."owns_business"("business_id") AND ("status" = 'pendente'::"text") AND ("approved_by" IS NULL) AND ("decided_at" IS NULL)));



ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_service_message_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professionals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "professionals_owner" ON "public"."professionals" TO "authenticated" USING ("public"."owns_business"("business_id")) WITH CHECK ("public"."owns_business"("business_id"));



CREATE POLICY "professionals_public_read" ON "public"."professionals" FOR SELECT TO "anon" USING ("active");



CREATE POLICY "professionals_self_read" ON "public"."professionals" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_own" ON "public"."profiles" TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."reminder_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reminder_logs_owner_read" ON "public"."reminder_logs" FOR SELECT TO "authenticated" USING ("public"."owns_business"("business_id"));



ALTER TABLE "public"."sdr_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sdr_ideas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sdrs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_categories_member_read" ON "public"."service_categories" FOR SELECT TO "authenticated" USING ("public"."is_business_member"("business_id"));



CREATE POLICY "service_categories_owner_manage" ON "public"."service_categories" TO "authenticated" USING ("public"."owns_business"("business_id")) WITH CHECK ("public"."owns_business"("business_id"));



CREATE POLICY "service_categories_public_read" ON "public"."service_categories" FOR SELECT TO "anon" USING ("active");



ALTER TABLE "public"."service_professionals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_professionals_member_read" ON "public"."service_professionals" FOR SELECT TO "authenticated" USING ("public"."is_business_member"("business_id"));



CREATE POLICY "service_professionals_owner_manage" ON "public"."service_professionals" TO "authenticated" USING ("public"."owns_business"("business_id")) WITH CHECK (("public"."owns_business"("business_id") AND (EXISTS ( SELECT 1
   FROM "public"."services" "s"
  WHERE (("s"."id" = "service_professionals"."service_id") AND ("s"."business_id" = "service_professionals"."business_id")))) AND (EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."id" = "service_professionals"."professional_id") AND ("p"."business_id" = "service_professionals"."business_id"))))));



CREATE POLICY "service_professionals_public_read" ON "public"."service_professionals" FOR SELECT TO "anon" USING (((EXISTS ( SELECT 1
   FROM "public"."services" "s"
  WHERE (("s"."id" = "service_professionals"."service_id") AND "s"."active" AND "s"."show_service"))) AND (EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."id" = "service_professionals"."professional_id") AND "p"."active")))));



ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "services_member_read" ON "public"."services" FOR SELECT TO "authenticated" USING ("public"."is_business_member"("business_id"));



CREATE POLICY "services_owner" ON "public"."services" TO "authenticated" USING ("public"."owns_business"("business_id")) WITH CHECK ("public"."owns_business"("business_id"));



CREATE POLICY "services_public_read" ON "public"."services" FOR SELECT TO "anon" USING ("active");



ALTER TABLE "public"."subscription_charges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_lifecycle_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription_payments_member_read" ON "public"."subscription_payments" FOR SELECT TO "authenticated" USING ("public"."is_business_member"("business_id"));



CREATE POLICY "subscription_payments_owner" ON "public"."subscription_payments" TO "authenticated" USING ("public"."owns_business"("business_id")) WITH CHECK ("public"."owns_business"("business_id"));



ALTER TABLE "public"."support_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "support_owner_insert_user" ON "public"."support_messages" FOR INSERT TO "authenticated" WITH CHECK ((("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))) AND ("sender" = 'user'::"text") AND ("read_by_user" IS NOT NULL)));



CREATE POLICY "support_owner_select" ON "public"."support_messages" FOR SELECT TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "support_owner_update_read" ON "public"."support_messages" FOR UPDATE TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"())))) WITH CHECK ((("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))) AND ("sender" = 'master'::"text") AND "read_by_user"));



ALTER TABLE "public"."time_blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "time_blocks_owner" ON "public"."time_blocks" TO "authenticated" USING ("public"."owns_business"("business_id")) WITH CHECK ("public"."owns_business"("business_id"));



CREATE POLICY "time_blocks_professional_manage" ON "public"."time_blocks" TO "authenticated" USING (("public"."has_business_permission"("business_id", 'block_schedule'::"text") OR "public"."has_business_permission"("business_id", 'block_agenda'::"text"))) WITH CHECK (("public"."has_business_permission"("business_id", 'block_schedule'::"text") OR "public"."has_business_permission"("business_id", 'block_agenda'::"text")));



CREATE POLICY "time_blocks_professional_read" ON "public"."time_blocks" FOR SELECT TO "authenticated" USING ("public"."is_business_member"("business_id"));



CREATE POLICY "time_blocks_public_read" ON "public"."time_blocks" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_admin_read" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "user_roles_select_own" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."wallets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_greeting_replies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."withdrawals" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."business_logos_image_business_id"("_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."business_logos_image_business_id"("_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."business_logos_image_business_id"("_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_logos_image_business_id"("_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."business_professional_photo_business_id"("_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."business_professional_photo_business_id"("_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."business_professional_photo_business_id"("_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_professional_photo_business_id"("_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."business_visual_asset_business_id"("_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."business_visual_asset_business_id"("_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."business_visual_asset_business_id"("_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."business_visual_asset_business_id"("_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_overdue_business"("p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_overdue_business"("p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_deposit_pix"("_charge_id" "uuid", "_lease_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_deposit_pix"("_charge_id" "uuid", "_lease_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_post_service_messages"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_post_service_messages"("p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_whatsapp_greeting"("p_business_id" "uuid", "p_sender_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_whatsapp_greeting"("p_business_id" "uuid", "p_sender_phone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finish_whatsapp_greeting"("p_business_id" "uuid", "p_sender_phone" "text", "p_claim_token" "uuid", "p_sent" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finish_whatsapp_greeting"("p_business_id" "uuid", "p_sender_phone" "text", "p_claim_token" "uuid", "p_sent" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_business_control_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_business_control_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_business_control_columns"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_business_permission"("_business_id" "uuid", "_permission" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_business_permission"("_business_id" "uuid", "_permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_business_permission"("_business_id" "uuid", "_permission" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_business_member"("_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_business_member"("_business_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_business_member"("_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ledger_adjustment"("_business_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text", "_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ledger_adjustment"("_business_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text", "_description" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ledger_credit_payment"("_business_id" "uuid", "_payment_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text", "_description" "text", "_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ledger_credit_payment"("_business_id" "uuid", "_payment_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text", "_description" "text", "_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ledger_debit_refund"("_business_id" "uuid", "_payment_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text", "_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ledger_debit_refund"("_business_id" "uuid", "_payment_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text", "_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ledger_entries_immutable"() TO "anon";
GRANT ALL ON FUNCTION "public"."ledger_entries_immutable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ledger_entries_immutable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."ledger_request_withdrawal"("_business_id" "uuid", "_withdrawal_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ledger_request_withdrawal"("_business_id" "uuid", "_withdrawal_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ledger_reverse_withdrawal"("_business_id" "uuid", "_withdrawal_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ledger_reverse_withdrawal"("_business_id" "uuid", "_withdrawal_id" "uuid", "_amount_cents" integer, "_idempotency_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ledger_settle_withdrawal"("_withdrawal_id" "uuid", "_outcome" "text", "_provider_ref" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ledger_settle_withdrawal"("_withdrawal_id" "uuid", "_outcome" "text", "_provider_ref" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_deposit_pix_post_started"("_charge_id" "uuid", "_claim_token" "uuid", "_lease_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_deposit_pix_post_started"("_charge_id" "uuid", "_claim_token" "uuid", "_lease_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."owns_business"("_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."owns_business"("_business_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."owns_business"("_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."register_auth_failure"("p_key" "text", "p_limit" integer, "p_window_ms" bigint, "p_lock_ms" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."register_auth_failure"("p_key" "text", "p_limit" integer, "p_window_ms" bigint, "p_lock_ms" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."release_deposit_pix"("_charge_id" "uuid", "_claim_token" "uuid", "_outcome" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."release_deposit_pix"("_charge_id" "uuid", "_claim_token" "uuid", "_outcome" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."replace_professional_services"("_business_id" "uuid", "_professional_id" "uuid", "_service_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_professional_services"("_business_id" "uuid", "_professional_id" "uuid", "_service_ids" "uuid"[]) TO "authenticated";



GRANT ALL ON FUNCTION "public"."touch_business_visual_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_business_visual_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_business_visual_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_business_whatsapp_credentials_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_business_whatsapp_credentials_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_business_whatsapp_credentials_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."agpay_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."asaas_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."auth_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."broadcasts" TO "anon";
GRANT ALL ON TABLE "public"."broadcasts" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcasts" TO "service_role";



GRANT ALL ON TABLE "public"."business_hours" TO "anon";
GRANT ALL ON TABLE "public"."business_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."business_hours" TO "service_role";



GRANT ALL ON TABLE "public"."business_outreach_overrides" TO "anon";
GRANT ALL ON TABLE "public"."business_outreach_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."business_outreach_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."business_visual_settings" TO "anon";
GRANT ALL ON TABLE "public"."business_visual_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."business_visual_settings" TO "service_role";



GRANT ALL ON TABLE "public"."business_whatsapp_credentials" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."businesses" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."businesses" TO "authenticated";
GRANT ALL ON TABLE "public"."businesses" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."businesses" TO "anon";



GRANT SELECT("name") ON TABLE "public"."businesses" TO "anon";



GRANT SELECT("category") ON TABLE "public"."businesses" TO "anon";



GRANT SELECT("phone") ON TABLE "public"."businesses" TO "anon";



GRANT SELECT("address") ON TABLE "public"."businesses" TO "anon";



GRANT SELECT("status") ON TABLE "public"."businesses" TO "anon";



GRANT SELECT("brand_primary") ON TABLE "public"."businesses" TO "anon";



GRANT SELECT("brand_background") ON TABLE "public"."businesses" TO "anon";



GRANT UPDATE("reminder_enabled") ON TABLE "public"."businesses" TO "authenticated";



GRANT UPDATE("reminder_hours_before") ON TABLE "public"."businesses" TO "authenticated";



GRANT SELECT("logo_url") ON TABLE "public"."businesses" TO "anon";
GRANT UPDATE("logo_url") ON TABLE "public"."businesses" TO "authenticated";



GRANT UPDATE("withdrawal_pix_key") ON TABLE "public"."businesses" TO "authenticated";



GRANT UPDATE("withdrawal_pix_key_type") ON TABLE "public"."businesses" TO "authenticated";



GRANT UPDATE("brand_background_image") ON TABLE "public"."businesses" TO "authenticated";



GRANT UPDATE("withdrawal_pin_hash") ON TABLE "public"."businesses" TO "authenticated";



GRANT UPDATE("pix_mode") ON TABLE "public"."businesses" TO "authenticated";



GRANT UPDATE("pix_exception_clients") ON TABLE "public"."businesses" TO "authenticated";



GRANT UPDATE("theme") ON TABLE "public"."businesses" TO "authenticated";



GRANT ALL ON TABLE "public"."client_error_log" TO "anon";
GRANT ALL ON TABLE "public"."client_error_log" TO "authenticated";
GRANT ALL ON TABLE "public"."client_error_log" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."deposit_payments" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ledger_entries" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ledger_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."ledger_entries" TO "service_role";



GRANT ALL ON TABLE "public"."master_business_events" TO "anon";
GRANT ALL ON TABLE "public"."master_business_events" TO "authenticated";
GRANT ALL ON TABLE "public"."master_business_events" TO "service_role";



GRANT ALL ON TABLE "public"."master_business_notes" TO "anon";
GRANT ALL ON TABLE "public"."master_business_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."master_business_notes" TO "service_role";



GRANT ALL ON TABLE "public"."master_impersonation_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."outreach_templates" TO "anon";
GRANT ALL ON TABLE "public"."outreach_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."outreach_templates" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pix_key_approvals" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pix_key_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."pix_key_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."post_service_message_queue" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."professionals" TO "anon";
GRANT ALL ON TABLE "public"."professionals" TO "authenticated";
GRANT ALL ON TABLE "public"."professionals" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."professionals" TO "anon";



GRANT SELECT("name") ON TABLE "public"."professionals" TO "anon";



GRANT SELECT("role") ON TABLE "public"."professionals" TO "anon";



GRANT SELECT("active") ON TABLE "public"."professionals" TO "anon";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reminder_logs" TO "anon";
GRANT ALL ON TABLE "public"."reminder_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."reminder_logs" TO "service_role";



GRANT ALL ON TABLE "public"."sdr_config" TO "service_role";



GRANT ALL ON TABLE "public"."sdr_ideas" TO "service_role";



GRANT ALL ON TABLE "public"."sdrs" TO "service_role";



GRANT ALL ON TABLE "public"."service_categories" TO "anon";
GRANT ALL ON TABLE "public"."service_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."service_categories" TO "service_role";



GRANT ALL ON TABLE "public"."service_professionals" TO "anon";
GRANT ALL ON TABLE "public"."service_professionals" TO "authenticated";
GRANT ALL ON TABLE "public"."service_professionals" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."subscription_charges" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."subscription_charges" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_charges" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_lifecycle_runs" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_payments" TO "anon";
GRANT ALL ON TABLE "public"."subscription_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_payments" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."support_messages" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."support_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."support_messages" TO "service_role";



GRANT UPDATE("read_by_user") ON TABLE "public"."support_messages" TO "authenticated";



GRANT ALL ON TABLE "public"."time_blocks" TO "anon";
GRANT ALL ON TABLE "public"."time_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."time_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."wallets" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."wallets" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_greeting_replies" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."withdrawals" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."withdrawals" TO "authenticated";
GRANT ALL ON TABLE "public"."withdrawals" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
