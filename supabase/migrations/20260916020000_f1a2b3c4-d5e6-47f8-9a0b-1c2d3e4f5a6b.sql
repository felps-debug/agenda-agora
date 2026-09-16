-- O banco de produção nunca recebeu essa coluna, apesar da migration
-- 20260907041401_d155da39-0eda-4439-9a4d-2261f1de7b30.sql já pedir pra criá-la
-- (drift entre o repo e o schema real — confirmado coluna a coluna via REST API
-- na madrugada de 15→16/09/2026: só esta estava faltando).
-- Sem ela, QUALQUER select que combine logo_url com outras colunas de businesses
-- falha com 42703 e derruba a página pública de agendamento inteira.

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS logo_url text;
