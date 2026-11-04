-- Dossiê master: senha do acesso do estabelecimento visível no Painel 3
-- (o master precisa saber qual é a senha do painel de cada conta).
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS access_password text;

UPDATE public.businesses
SET access_password = substring(access_password from 13)
WHERE access_password LIKE 'agendaagora:%';
