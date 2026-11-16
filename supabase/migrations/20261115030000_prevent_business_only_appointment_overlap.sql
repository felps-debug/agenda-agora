-- A reserva sem profissional ocupa o calendário único do negócio. Como um NULL
-- não colide com outro NULL em uma exclusion constraint, ela precisa de uma
-- regra própria no banco para resistir a criações e remarcações concorrentes.
-- Mantém a elegibilidade já usada pelo fluxo: canceladas e aguardando sinal
-- não bloqueiam horário até a cobrança ser confirmada.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlap_per_business_without_professional
  EXCLUDE USING gist (
    business_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (professional_id IS NULL AND status NOT IN ('cancelado', 'aguardando_sinal'));
