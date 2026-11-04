-- APPLY ONLY AFTER deploying code that no longer reads or writes these columns
-- and creating the logical backup at specs/010-endurecimento-versao-cliente/backup-segredos.local.
BEGIN;

ALTER TABLE public.businesses
  DROP COLUMN IF EXISTS withdrawal_pin_plain,
  DROP COLUMN IF EXISTS access_password;

COMMIT;

-- Rollback outline (restore values from the logical backup after recreating columns):
-- BEGIN;
-- ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS withdrawal_pin_plain text;
-- ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS access_password text;
-- COMMIT;