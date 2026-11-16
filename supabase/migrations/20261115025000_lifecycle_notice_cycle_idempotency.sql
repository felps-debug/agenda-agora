ALTER TABLE public.master_business_events
  ADD COLUMN IF NOT EXISTS dedupe_key text;

-- NULL keeps existing manually-created events outside lifecycle deduplication.
CREATE UNIQUE INDEX IF NOT EXISTS master_business_events_business_dedupe_key_uidx
  ON public.master_business_events (business_id, dedupe_key);
