ALTER TABLE public.businesses
  DROP COLUMN IF EXISTS withdrawal_pin_plain,
  DROP COLUMN IF EXISTS access_password;;
