import { z } from "zod";

export const OUTREACH_DESIGN_MAX_BYTES = 3 * 1024 * 1024;
const backgroundImagePattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export const OUTREACH_FONTS = [
  "inter",
  "playfair-display",
  "montserrat",
  "poppins",
  "lato",
  "roboto",
  "oswald",
  "merriweather",
] as const;

export const OUTREACH_ICON_KEYS = [
  "scissors",
  "calendar",
  "clock",
  "star",
  "sparkles",
  "map-pin",
  "phone",
  "whatsapp",
  "check",
  "heart",
  "gift",
  "crown",
  "bell",
  "tag",
  "thumbs-up",
  "users",
  "smile",
  "camera",
  "flame",
  "percent",
] as const;

export const OUTREACH_PLACEHOLDERS = [
  "{nome_empresa}",
  "{categoria}",
  "{telefone}",
  "{endereco}",
  "{link_publico}",
] as const;

const colorSchema = z.string().regex(/^#[\da-fA-F]{6}$/);
const baseLayer = z.object({
  id: z.string().min(1).max(80),
  x: z.number().finite().min(0).max(4000),
  y: z.number().finite().min(0).max(4000),
  width: z.number().finite().positive().max(4000),
  height: z.number().finite().positive().max(4000),
  rotation: z.number().finite().min(-360).max(360).default(0),
  opacity: z.number().finite().min(0).max(1).default(1),
});

export const outreachTextLayerSchema = baseLayer.extend({
  type: z.literal("text"),
  text: z.string().max(OUTREACH_DESIGN_MAX_BYTES),
  color: colorSchema,
  font: z.enum(OUTREACH_FONTS),
  fontSize: z.number().finite().min(8).max(300),
  fontWeight: z.enum(["normal", "medium", "semibold", "bold"]).default("normal"),
  align: z.enum(["left", "center", "right"]).default("left"),
});

export const outreachIconLayerSchema = baseLayer.extend({
  type: z.literal("icon"),
  iconKey: z.enum(OUTREACH_ICON_KEYS),
  color: colorSchema,
});

export const outreachShapeLayerSchema = baseLayer.extend({
  type: z.literal("shape"),
  shape: z.enum(["rectangle", "circle", "line"]),
  fill: colorSchema,
  stroke: colorSchema.optional(),
  strokeWidth: z.number().finite().min(0).max(100).default(0),
  radius: z.number().finite().min(0).max(500).default(0),
});

export const outreachDesignSchema = z
  .object({
    version: z.literal(1),
    width: z.number().int().min(320).max(4000),
    height: z.number().int().min(320).max(4000),
    background: colorSchema,
    backgroundImage: z.string().regex(backgroundImagePattern).max(4_200_000).nullable().optional(),
    layers: z
      .array(
        z.discriminatedUnion("type", [
          outreachTextLayerSchema,
          outreachIconLayerSchema,
          outreachShapeLayerSchema,
        ]),
      )
      .max(100),
  })
  .strict();

export type OutreachDesign = z.infer<typeof outreachDesignSchema>;
export type OutreachDesignLayer = OutreachDesign["layers"][number];

/** Valida o documento e limita o tamanho serializado antes de persistir. */
export function parseOutreachDesign(value: unknown): OutreachDesign {
  const design = outreachDesignSchema.parse(value);
  if (new TextEncoder().encode(JSON.stringify(design)).byteLength > OUTREACH_DESIGN_MAX_BYTES) {
    throw new Error("O design do template excede o limite permitido.");
  }
  return design;
}

/** Rejeita placeholders que não pertencem ao contrato dos templates de divulgação. */
export function validateOutreachPlaceholders(text: string): boolean {
  const tokens = text.match(/\{[^{}]+\}/g) ?? [];
  return tokens.every((token) => (OUTREACH_PLACEHOLDERS as readonly string[]).includes(token));
}
