-- Editor visual de divulgação. Para retornar: remova os cinco seeds com
-- is_default = true, elimine business_outreach_overrides e então as duas colunas.
ALTER TABLE public.outreach_templates
  ADD COLUMN design jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN is_default boolean NOT NULL DEFAULT false;

CREATE TABLE public.business_outreach_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.outreach_templates(id) ON DELETE CASCADE,
  design jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_outreach_overrides_business_template_key UNIQUE (business_id, template_id)
);

ALTER TABLE public.business_outreach_overrides ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_outreach_overrides TO authenticated;

CREATE POLICY business_outreach_overrides_owner_all
  ON public.business_outreach_overrides
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = business_id AND b.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = business_id AND b.owner_id = auth.uid()
  ));

CREATE INDEX business_outreach_overrides_business_idx
  ON public.business_outreach_overrides (business_id);

-- Templates textuais legados ficam disponíveis para leitura administrativa,
-- mas não aparecem mais como templates ativos nas contas.
UPDATE public.outreach_templates SET active = false WHERE active;

INSERT INTO public.outreach_templates (title, usage_type, body, active, design, is_default)
SELECT seed.title, 'story', seed.title, true, seed.design::jsonb, true
FROM (VALUES
  ('Agenda aberta', '{"version":1,"width":1080,"height":1080,"background":"#101828","layers":[{"id":"headline","type":"text","x":90,"y":300,"width":900,"height":160,"rotation":0,"opacity":1,"text":"AGENDA ABERTA","color":"#ffffff","font":"montserrat","fontSize":86,"fontWeight":"bold","align":"center"},{"id":"sub","type":"text","x":100,"y":510,"width":880,"height":100,"rotation":0,"opacity":1,"text":"Reserve seu horário","color":"#d1e8ff","font":"inter","fontSize":42,"fontWeight":"medium","align":"center"}]}'),
  ('Promoção', '{"version":1,"width":1080,"height":1080,"background":"#5b1835","layers":[{"id":"badge","type":"shape","x":90,"y":180,"width":900,"height":700,"rotation":0,"opacity":1,"shape":"rectangle","fill":"#8b1e4b","stroke":"#f8c4d7","strokeWidth":5,"radius":48},{"id":"headline","type":"text","x":140,"y":350,"width":800,"height":180,"rotation":0,"opacity":1,"text":"OFERTA ESPECIAL","color":"#ffffff","font":"oswald","fontSize":76,"fontWeight":"bold","align":"center"},{"id":"sub","type":"text","x":150,"y":570,"width":780,"height":90,"rotation":0,"opacity":1,"text":"Aproveite por tempo limitado","color":"#ffe4ee","font":"inter","fontSize":34,"fontWeight":"medium","align":"center"}]}'),
  ('Novo horário', '{"version":1,"width":1080,"height":1080,"background":"#073b3a","layers":[{"id":"icon","type":"icon","x":450,"y":200,"width":180,"height":180,"rotation":0,"opacity":1,"iconKey":"calendar","color":"#7ce5cb"},{"id":"headline","type":"text","x":100,"y":460,"width":880,"height":140,"rotation":0,"opacity":1,"text":"NOVOS HORÁRIOS","color":"#ffffff","font":"poppins","fontSize":66,"fontWeight":"bold","align":"center"},{"id":"sub","type":"text","x":120,"y":640,"width":840,"height":100,"rotation":0,"opacity":1,"text":"Mais opções para você","color":"#c7fff1","font":"inter","fontSize":38,"fontWeight":"medium","align":"center"}]}'),
  ('Combo corte e barba', '{"version":1,"width":1080,"height":1080,"background":"#2b2118","layers":[{"id":"headline","type":"text","x":90,"y":270,"width":900,"height":140,"rotation":0,"opacity":1,"text":"COMBO","color":"#f8d9a0","font":"playfair-display","fontSize":88,"fontWeight":"bold","align":"center"},{"id":"sub","type":"text","x":100,"y":440,"width":880,"height":140,"rotation":0,"opacity":1,"text":"CORTE + BARBA","color":"#ffffff","font":"montserrat","fontSize":62,"fontWeight":"bold","align":"center"},{"id":"ornament","type":"shape","x":290,"y":630,"width":500,"height":8,"rotation":0,"opacity":1,"shape":"line","fill":"#f8d9a0","stroke":"#f8d9a0","strokeWidth":8,"radius":0}]}'),
  ('Indique um amigo', '{"version":1,"width":1080,"height":1080,"background":"#162742","layers":[{"id":"icon","type":"icon","x":450,"y":190,"width":180,"height":180,"rotation":0,"opacity":1,"iconKey":"star","color":"#ffd36e"},{"id":"headline","type":"text","x":100,"y":430,"width":880,"height":180,"rotation":0,"opacity":1,"text":"INDIQUE UM AMIGO","color":"#ffffff","font":"lato","fontSize":68,"fontWeight":"bold","align":"center"},{"id":"sub","type":"text","x":140,"y":650,"width":800,"height":110,"rotation":0,"opacity":1,"text":"E aproveitem juntos!","color":"#d4e3ff","font":"inter","fontSize":42,"fontWeight":"medium","align":"center"}]}')
) AS seed(title, design)
WHERE NOT EXISTS (
  SELECT 1 FROM public.outreach_templates t WHERE t.title = seed.title AND t.is_default
);

-- Verificação em banco limpo:
-- SELECT count(*) = 5 AS cinco_templates FROM public.outreach_templates WHERE is_default;
-- SELECT to_regclass('public.business_outreach_overrides') IS NOT NULL AS tabela_criada;
