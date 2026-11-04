-- Tema de cor do sistema por estabelecimento (identidade visual do SaaS).
-- 'azul' = padrão; 'rosa' = identidade feminina; 'dourado' = identidade
-- dourada/amarela. Aplicado no boot do painel e na aba "Visão geral"
-- (Informações da conta) do perfil.
alter table public.businesses
  add column if not exists theme text default 'azul';
