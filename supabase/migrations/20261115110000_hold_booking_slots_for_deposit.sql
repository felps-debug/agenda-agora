-- Pending deposit reservations hold the slot until their local state is
-- reconciled by the AgPay worker. Rebuilding validates existing rows first;
-- conflicting legacy holds cause this migration to fail without replacing the
-- original constraints.
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_no_overlap_per_professional;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlap_per_professional
  EXCLUDE USING gist (
    professional_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  )
  WHERE (professional_id IS NOT NULL AND status <> 'cancelado');

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_no_overlap_per_business_without_professional;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlap_per_business_without_professional
  EXCLUDE USING gist (
    business_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  )
  WHERE (professional_id IS NULL AND status <> 'cancelado');
