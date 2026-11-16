-- All businesses now use the Elegance public layout. Keep the saved appearance
-- and content JSON untouched so colors, text, and per-layout media remain intact.
BEGIN;

UPDATE public.business_visual_settings
SET layout_key = 'elegance'
WHERE layout_key IS DISTINCT FROM 'elegance';

COMMIT;
