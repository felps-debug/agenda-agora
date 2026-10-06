import { z } from "zod";
import { PANEL1_FONTS, PANEL1_LOGO_FITS, type Panel1Appearance } from "@/lib/panel1-config";
import { VISUAL_NICHE_IDS } from "@/lib/visual-presets";

export const visualLayoutKeySchema = z.enum(["classic", "liquid_glass"]);
export const visualNicheIdSchema = z.enum(VISUAL_NICHE_IDS);
export const visualColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const panel1AppearanceV2Schema = z
  .object({
    font_family: z.enum(PANEL1_FONTS),
    logo_fit: z.enum(PANEL1_LOGO_FITS),
    page_text: visualColorSchema,
    header_background: visualColorSchema,
    header_text: visualColorSchema,
    header_title: visualColorSchema,
    service_name_text: visualColorSchema,
    service_price_text: visualColorSchema,
    service_background: visualColorSchema,
    service_text: visualColorSchema,
    service_border: visualColorSchema,
    service_hover_background: visualColorSchema,
    service_hover_text: visualColorSchema,
    service_hover_border: visualColorSchema,
    modal_background: visualColorSchema,
    modal_text: visualColorSchema,
    modal_hover_background: visualColorSchema,
    modal_hover_text: visualColorSchema,
    modal_active_background: visualColorSchema,
    modal_active_text: visualColorSchema,
    modal_border: visualColorSchema,
    agenda_background: visualColorSchema,
    agenda_text: visualColorSchema,
    agenda_border: visualColorSchema,
  })
  .strict() satisfies z.ZodType<Panel1Appearance>;

export const publishedVisualSettingsSchema = z
  .object({
    schema_version: z.literal(2),
    revision: z.number().int().positive(),
    layout_key: visualLayoutKeySchema,
    niche_id: visualNicheIdSchema,
    palette_id: z.string().min(1).max(80).nullable(),
    appearance: panel1AppearanceV2Schema,
    content: z
      .object({
        title: z.string().trim().max(120).optional(),
        subtitle: z.string().trim().max(180).optional(),
        primary_cta_label: z.string().trim().max(50).optional(),
      })
      .strict()
      .default({}),
  })
  .strict();

export type PublishedVisualSettings = z.infer<typeof publishedVisualSettingsSchema>;
