-- Dados mínimos de referência ausentes do snapshot --schema-only de produção.
INSERT INTO public.platform_settings (key, value)
VALUES
  ('agpay_fees', '{"deposit_fixed_cents":75,"withdraw_fixed_cents":300}'::jsonb),
  ('lifecycle_auto_cancel_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-logos',
  'business-logos',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/json']
)
ON CONFLICT (id) DO NOTHING;
