alter table public.businesses
  add column if not exists payment_confirmation_template text,
  add column if not exists selected_outreach_template_ids uuid[] not null default '{}'::uuid[];

-- Rollback: alter table public.businesses drop column if exists payment_confirmation_template;
-- alter table public.businesses drop column if exists selected_outreach_template_ids;
