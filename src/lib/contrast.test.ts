import { describe, expect, it } from "vitest";
import { accessibleTextColor, contrastRatio, relativeLuminance } from "./contrast";
import { DEFAULT_PANEL1_APPEARANCE, PANEL1_APPEARANCE_PRESETS } from "./panel1-config";

describe("contraste de cores WCAG", () => {
  it("calcula a luminância relativa de preto e branco", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBe(1);
  });

  it("calcula a razão de contraste de preto e branco como 21:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
  });

  it.each(["#123b35", "#d7efff", "#777777", "#f4f6f8", "#050607", "#ffcc00"])(
    "escolhe texto com contraste AA de pelo menos 4.5:1 sobre %s",
    (background) => {
      const foreground = accessibleTextColor(background);
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(Object.entries(PANEL1_APPEARANCE_PRESETS))(
    "mantém contraste AA no cabeçalho e nos cartões do preset %s",
    (_name, preset) => {
      const appearance = { ...DEFAULT_PANEL1_APPEARANCE, ...preset };
      for (const background of [
        appearance.header_background,
        appearance.service_background,
        appearance.agenda_background,
        appearance.modal_background,
        appearance.service_hover_background,
        appearance.modal_hover_background,
        appearance.modal_active_background,
      ]) {
        expect(contrastRatio(accessibleTextColor(background), background)).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    },
  );

  it("mantém contraste no preset Claro com cabeçalho verde personalizado", () => {
    const background = "#123b35";
    expect(contrastRatio(accessibleTextColor(background), background)).toBeGreaterThanOrEqual(4.5);
  });

  it("rejeita formatos de cor que não são hexadecimais RGB de seis dígitos", () => {
    expect(() => relativeLuminance("#fff")).toThrow("#RRGGBB");
    expect(() => accessibleTextColor("verde")).toThrow("#RRGGBB");
  });
});
