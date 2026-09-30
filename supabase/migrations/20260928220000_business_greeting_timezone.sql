ALTER TABLE public.businesses
  ADD COLUMN greeting text,
  ADD COLUMN timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD CONSTRAINT businesses_greeting_length_check
    CHECK (greeting IS NULL OR char_length(greeting) <= 500),
  ADD CONSTRAINT businesses_timezone_length_check
    CHECK (char_length(timezone) <= 64);

-- Rollback:
-- ALTER TABLE public.businesses
--   DROP CONSTRAINT IF EXISTS businesses_greeting_length_check,
--   DROP CONSTRAINT IF EXISTS businesses_timezone_length_check,
--   DROP COLUMN IF EXISTS greeting,
--   DROP COLUMN IF EXISTS timezone;
