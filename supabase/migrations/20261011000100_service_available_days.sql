-- Dias da semana em que cada serviço pode ser agendado (aba Vínculos no
-- cadastro do serviço). 1=segunda ... 6=sábado, mesma convenção de
-- professionals.working_days. Ausência (legado) = todos os dias.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS available_days smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6];
