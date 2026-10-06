import {
  PANEL1_APPEARANCE_PRESETS,
  PANEL1_PRESET_DETAILS,
  type Panel1AppearancePreset,
} from "@/lib/panel1-config";

export const VISUAL_NICHE_IDS = [
  "barbearia",
  "salao",
  "consultorio",
  "estetica",
  "pet",
  "outro",
] as const;

export type VisualNicheId = (typeof VISUAL_NICHE_IDS)[number];
export type VisualLayoutKey = "classic" | "liquid_glass";

export type SemanticVisualTokens = {
  primary: string;
  onPrimary: string;
  background: string;
  surface: string;
  onSurface: string;
  border: string;
  accent: string;
  shadow: string;
};

export type VisualPalette = {
  id: Panel1AppearancePreset;
  label: string;
  description: string;
  tokens: SemanticVisualTokens;
};

export const VISUAL_NICHES: ReadonlyArray<{
  id: VisualNicheId;
  label: string;
  recommendedPaletteIds: Panel1AppearancePreset[];
}> = [
  { id: "barbearia", label: "Barbearia", recommendedPaletteIds: ["classico", "noturno", "oceano"] },
  { id: "salao", label: "Salão", recommendedPaletteIds: ["rose", "claro", "verde"] },
  { id: "consultorio", label: "Consultório", recommendedPaletteIds: ["claro", "oceano", "verde"] },
  { id: "estetica", label: "Estética", recommendedPaletteIds: ["rose", "claro", "verde"] },
  { id: "pet", label: "Pet shop", recommendedPaletteIds: ["verde", "oceano", "claro"] },
  { id: "outro", label: "Geral", recommendedPaletteIds: ["noturno", "classico", "claro"] },
];

export const VISUAL_PALETTES: ReadonlyArray<VisualPalette> = (
  Object.keys(PANEL1_APPEARANCE_PRESETS) as Panel1AppearancePreset[]
).map((id) => {
  const appearance = PANEL1_APPEARANCE_PRESETS[id];
  const details = PANEL1_PRESET_DETAILS[id];
  return {
    id,
    label: details.name,
    description: details.description,
    tokens: {
      primary: appearance.modal_active_background,
      onPrimary: appearance.modal_active_text,
      background: details.pageBackground,
      surface: appearance.service_background,
      onSurface: appearance.service_text,
      border: appearance.service_border,
      accent: appearance.service_hover_border,
      shadow: appearance.header_background,
    },
  };
});

export const PANEL_LAYOUT_MODELS: ReadonlyArray<{
  id: VisualLayoutKey;
  label: string;
  description: string;
}> = [
  { id: "classic", label: "Clássico", description: "O modelo atual, direto e familiar." },
  {
    id: "liquid_glass",
    label: "Liquid Glass",
    description: "Superfícies translúcidas, brilho e profundidade.",
  },
];

export function isVisualNicheId(value: unknown): value is VisualNicheId {
  return typeof value === "string" && (VISUAL_NICHE_IDS as readonly string[]).includes(value);
}

export function recommendedPalettesForNiche(nicheId: VisualNicheId) {
  return (
    VISUAL_NICHES.find((niche) => niche.id === nicheId)?.recommendedPaletteIds ??
    VISUAL_NICHES.find((niche) => niche.id === "outro")!.recommendedPaletteIds
  );
}
