-- Nomes de exibicao do profissional:
-- agenda_name: nome curto (max 12) exibido ao lado dos dias na agenda do Painel 2;
-- public_name: nome exibido para o cliente no Painel 1 ao agendar.
alter table professionals add column if not exists agenda_name text;
alter table professionals add column if not exists public_name text;
