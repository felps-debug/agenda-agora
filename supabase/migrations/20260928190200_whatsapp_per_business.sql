alter table public.businesses
  add column if not exists whatsapp_instance_id text,
  add column if not exists whatsapp_instance_token text;

-- Rollback: alter table public.businesses drop column if exists whatsapp_instance_token;
-- alter table public.businesses drop column if exists whatsapp_instance_id;
