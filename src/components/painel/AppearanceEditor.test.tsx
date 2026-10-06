import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_PANEL1_APPEARANCE, PANEL1_APPEARANCE_PRESETS } from "@/lib/panel1-config";
import {
  AppearanceEditor,
  getLowContrastAppearanceLabels,
  hasDivergentAppearanceCustomization,
} from "./AppearanceEditor";

describe("AppearanceEditor contraste", () => {
  it("identifica combinações abaixo de 4,5:1", () => {
    const appearance = {
      ...DEFAULT_PANEL1_APPEARANCE,
      header_background: "#123b35",
      header_title: "#123b35",
      service_background: "#d7efff",
      service_text: "#000000",
      service_name_text: "#000000",
      service_price_text: "#d7efff",
    };

    expect(getLowContrastAppearanceLabels(appearance)).toEqual([
      "título do negócio",
      "valor do serviço",
    ]);
  });

  it.each(Object.entries(PANEL1_APPEARANCE_PRESETS))(
    "não avisa para o preset legível %s",
    (_name, preset) => {
      const appearance = { ...DEFAULT_PANEL1_APPEARANCE, ...preset };
      expect(getLowContrastAppearanceLabels(appearance)).toEqual([]);
    },
  );

  it("exibe o aviso sem bloquear salvar", () => {
    const appearance = {
      ...DEFAULT_PANEL1_APPEARANCE,
      header_title: DEFAULT_PANEL1_APPEARANCE.header_background,
    };
    const markup = renderToStaticMarkup(
      createElement(AppearanceEditor, {
        appearance,
        onChange: () => {},
        onApplyPreset: () => {},
        onSave: () => {},
        saving: false,
        layoutKey: "classic",
        onLayoutKeyChange: () => {},
        nicheId: "barbearia",
        onNicheIdChange: () => {},
        businessName: "Barbearia teste",
        businessLogoUrl: null,
        businessAddress: null,
        pageBackground: "#ffffff",
        onPageBackgroundChange: () => {},
        services: [],
        onLogoFileSelected: () => {},
        logoUploading: false,
        backgroundImageUrl: null,
        onBackgroundImageFileSelected: () => {},
        onClearBackgroundImage: () => {},
        backgroundImageUploading: false,
      }),
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain("O texto será ajustado automaticamente");
    expect(markup).toContain("Aplicar alterações");
  });

  it("mostra o negócio e os serviços reais, não o mockup fixo (US1)", () => {
    const markup = renderToStaticMarkup(
      createElement(AppearanceEditor, {
        appearance: DEFAULT_PANEL1_APPEARANCE,
        onChange: () => {},
        onApplyPreset: () => {},
        onSave: () => {},
        saving: false,
        layoutKey: "classic",
        onLayoutKeyChange: () => {},
        nicheId: "barbearia",
        onNicheIdChange: () => {},
        businessName: "Barbearia felipe",
        businessLogoUrl: null,
        businessAddress: null,
        pageBackground: "#ffffff",
        onPageBackgroundChange: () => {},
        services: [
          {
            id: "s1",
            name: "Corte masculino de verdade",
            duration_minutes: 40,
            price_cents: 6000,
            effectiveDepositCents: 0,
            show_price: true,
            show_duration: true,
          },
        ],
        onLogoFileSelected: () => {},
        logoUploading: false,
        backgroundImageUrl: null,
        onBackgroundImageFileSelected: () => {},
        onClearBackgroundImage: () => {},
        backgroundImageUploading: false,
      }),
    );

    expect(markup).toContain("Barbearia felipe");
    expect(markup).toContain("Corte masculino de verdade");
    expect(markup).not.toContain("Nome do negócio");
    expect(markup).not.toContain("Corte de cabelo");
  });
});

describe("hasDivergentAppearanceCustomization", () => {
  it("detecta quando um campo do preset já foi customizado (US3 cenário 3)", () => {
    const appearance = {
      ...DEFAULT_PANEL1_APPEARANCE,
      ...PANEL1_APPEARANCE_PRESETS.noturno,
      service_name_text: "#ff00ff",
    };
    expect(hasDivergentAppearanceCustomization(appearance, PANEL1_APPEARANCE_PRESETS.noturno)).toBe(
      true,
    );
  });

  it("não acusa divergência quando a aparência já bate com o preset", () => {
    const appearance = { ...DEFAULT_PANEL1_APPEARANCE, ...PANEL1_APPEARANCE_PRESETS.classico };
    expect(
      hasDivergentAppearanceCustomization(appearance, PANEL1_APPEARANCE_PRESETS.classico),
    ).toBe(false);
  });
});
