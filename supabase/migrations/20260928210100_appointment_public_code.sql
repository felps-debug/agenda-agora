-- Código público opaco para o cliente localizar a própria reserva em funções de servidor.
alter table public.appointments
  add column public_code uuid not null default gen_random_uuid();

create unique index appointments_public_code_uidx
  on public.appointments (public_code);

-- Rollback:
-- drop index if exists public.appointments_public_code_uidx;
-- alter table public.appointments drop column if exists public_code;
