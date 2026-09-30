alter table public.businesses
  add column if not exists brand_background_image text;

comment on column public.businesses.brand_background_image is
  'Caminho no bucket business-logos (kind "background") usado como imagem de fundo do Painel 1 público; null usa brand_background (cor sólida).';

-- Rollback: alter table public.businesses drop column if exists brand_background_image;
