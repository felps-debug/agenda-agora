import { describe, expect, it } from "vitest";
import {
  PANEL_LAYOUT_MODELS,
  VISUAL_NICHES,
  VISUAL_PALETTES,
  isVisualNicheId,
  recommendedPalettesForNiche,
} from "./visual-presets";

describe("visual presets", () => {
  it("oferece somente os dois modelos de painel acordados", () => {
    expect(PANEL_LAYOUT_MODELS.map((model) => model.id)).toEqual(["classic", "liquid_glass"]);
  });

  it("recomenda paletas existentes para cada nicho", () => {
    const paletteIds = new Set(VISUAL_PALETTES.map((palette) => palette.id));
    for (const niche of VISUAL_NICHES) {
      expect(recommendedPalettesForNiche(niche.id).every((id) => paletteIds.has(id))).toBe(true);
    }
  });

  it("aceita apenas nichos conhecidos", () => {
    expect(isVisualNicheId("barbearia")).toBe(true);
    expect(isVisualNicheId("academia")).toBe(false);
  });
});
