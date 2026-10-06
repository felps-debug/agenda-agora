import { describe, expect, it } from "vitest";
import {
  applyPanel1AppearancePreset,
  DEFAULT_PANEL1_APPEARANCE,
  normalizePanel1Config,
} from "./panel1-config";

describe("normalização de aparência do painel", () => {
  it("preenche as novas cores ao ler configurações antigas", () => {
    const config = normalizePanel1Config({ version: 1, appearance: { page_text: "#111111" } });
    expect(config.appearance.header_background).toBe(DEFAULT_PANEL1_APPEARANCE.header_background);
    expect(config.appearance.header_text).toBe(DEFAULT_PANEL1_APPEARANCE.header_text);
    expect(config.appearance.header_title).toBe(DEFAULT_PANEL1_APPEARANCE.header_title);
    expect(config.appearance.service_name_text).toBe(DEFAULT_PANEL1_APPEARANCE.service_name_text);
    expect(config.appearance.service_price_text).toBe(DEFAULT_PANEL1_APPEARANCE.service_price_text);
    expect(config.appearance.page_text).toBe("#111111");
  });

  it("preserva novas cores válidas e troca valores inválidos pelo padrão", () => {
    const config = normalizePanel1Config({
      appearance: { header_background: "#abcdef", service_price_text: "red" },
    });
    expect(config.appearance.header_background).toBe("#abcdef");
    expect(config.appearance.service_price_text).toBe(DEFAULT_PANEL1_APPEARANCE.service_price_text);
  });

  it("aplica um tema completo e preserva somente o formato da logo", () => {
    const current = { ...DEFAULT_PANEL1_APPEARANCE, page_text: "#123456" };
    const result = applyPanel1AppearancePreset(current, "classico");
    expect(result.header_background).toBe("#3a261d");
    expect(result.service_name_text).toBe("#2c211b");
    expect(result.page_text).toBe("#2c211b");
    expect(result.modal_active_background).toBe("#765333");
    expect(result.font_family).toBe("playfair-display");
    expect(result.logo_fit).toBe(current.logo_fit);
  });

  it("aceita fonte e tamanho de foto válidos", () => {
    const config = normalizePanel1Config({
      appearance: { font_family: "oswald", logo_fit: "horizontal" },
    });
    expect(config.appearance.font_family).toBe("oswald");
    expect(config.appearance.logo_fit).toBe("horizontal");
  });

  it("troca fonte e tamanho de foto inválidos pelo padrão", () => {
    const config = normalizePanel1Config({
      appearance: { font_family: "comic-sans", logo_fit: "gigante" },
    });
    expect(config.appearance.font_family).toBe(DEFAULT_PANEL1_APPEARANCE.font_family);
    expect(config.appearance.logo_fit).toBe(DEFAULT_PANEL1_APPEARANCE.logo_fit);
  });

  it("configuração sem appearance nenhuma cai nos padrões de fonte e foto", () => {
    const config = normalizePanel1Config({});
    expect(config.appearance.font_family).toBe("inter");
    expect(config.appearance.logo_fit).toBe("quadrado");
  });

  it("normaliza modelo e nicho visuais sem quebrar documentos antigos", () => {
    expect(normalizePanel1Config({}).visual).toEqual({
      layout_key: "classic",
      niche_id: "outro",
    });
    expect(
      normalizePanel1Config({
        visual: { layout_key: "liquid_glass", niche_id: "barbearia" },
      }).visual,
    ).toEqual({ layout_key: "liquid_glass", niche_id: "barbearia" });
    expect(
      normalizePanel1Config({ visual: { layout_key: "other", niche_id: "x" } }).visual,
    ).toEqual({
      layout_key: "classic",
      niche_id: "outro",
    });
  });
});
