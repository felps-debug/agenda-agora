-- O layout sofisticado volta como modelo selecionável "Elegance" no editor de
-- aparência, convivendo com o "Minimalista". Documentos antigos com
-- liquid_glass apontavam para o mesmo visual e passam a usar o novo valor.
UPDATE public.business_visual_settings
SET layout_key = 'elegance'
WHERE layout_key = 'liquid_glass';

ALTER TABLE public.business_visual_settings
  DROP CONSTRAINT IF EXISTS business_visual_settings_layout_key_check;

ALTER TABLE public.business_visual_settings
  ADD CONSTRAINT business_visual_settings_layout_key_check
  CHECK (layout_key IN ('classic', 'elegance'));
