-- reserveBooking() confere conflito de horário com um SELECT antes do INSERT (booking.functions.ts).
-- Isso é uma corrida clássica: dois clientes clicando "reservar" no mesmo slot ao mesmo tempo podem
-- passar os dois pela checagem antes de qualquer um inserir, resultando em dois agendamentos no
-- mesmo horário para o mesmo profissional. Trava isso no nível do banco com uma exclusion constraint,
-- que é atômica e não depende de timing da aplicação.
-- Cobre o caso com profissional definido (o majoritário). O caso sem profissional (calendário único
-- do negócio, quando o serviço não tem profissional vinculado) já tem uma checagem mais ampla na
-- aplicação e fica de fora daqui de propósito — profissional NULL nunca colide consigo mesmo em
-- exclusion constraints, então precisaria de uma regra própria a combinar com o Guilherme.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_overlap_per_professional
  EXCLUDE USING gist (
    professional_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  )
  WHERE (professional_id IS NOT NULL AND status NOT IN ('cancelado', 'aguardando_sinal'));
