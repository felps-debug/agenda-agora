CREATE TABLE IF NOT EXISTS public.whatsapp_incoming_greeting_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  dedupe_hash text NOT NULL UNIQUE,
  sender_phone text NOT NULL,
  sender_name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'skipped', 'error')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  processed_at timestamptz,
  last_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_incoming_greeting_events_due_idx
  ON public.whatsapp_incoming_greeting_events (status, available_at, received_at);

ALTER TABLE public.whatsapp_incoming_greeting_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_incoming_greeting_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.whatsapp_incoming_greeting_events TO service_role;

DROP TRIGGER IF EXISTS whatsapp_incoming_greeting_events_updated
  ON public.whatsapp_incoming_greeting_events;
CREATE TRIGGER whatsapp_incoming_greeting_events_updated
  BEFORE UPDATE ON public.whatsapp_incoming_greeting_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
