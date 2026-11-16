DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.business_hours'::regclass
      AND conname = 'business_hours_end_after_start'
  ) THEN
    ALTER TABLE public.business_hours
      ADD CONSTRAINT business_hours_end_after_start
      CHECK (ends_at > starts_at) NOT VALID;
  END IF;
END
$$;
