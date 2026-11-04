-- Opção do Master: aprovar automaticamente a PRIMEIRA chave Pix cadastrada
-- pela conta. Sem esta coluna, o recurso fica desligado (o código tolera a
-- ausência e trata a flag como false), mas é necessário executá-la para ativar.
alter table public.businesses
  add column if not exists agpay_auto_first_key boolean not null default false;
