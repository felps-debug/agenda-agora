import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_PANEL1_APPEARANCE, type Panel1Appearance } from "@/lib/panel1-config";
import { BusinessHeader, ServiceSection, type PreviewService } from "./appearance-preview";

/**
 * Regressão do bug encontrado no plano da spec 006 (research.md R2): a cor de texto
 * customizada era ignorada em favor de um cálculo automático de contraste, então
 * customizar header_title/service_name_text/service_price_text não tinha efeito real
 * na página pública. Estes testes garantem que os campos dedicados são respeitados.
 */

const appearance: Panel1Appearance = {
  ...DEFAULT_PANEL1_APPEARANCE,
  header_background: "#000000",
  header_text: "#ff00ff",
  header_title: "#00ffcc",
  service_background: "#000000",
  service_text: "#ff00ff",
  service_name_text: "#11ee11",
  service_price_text: "#eeaa11",
};

const service: PreviewService = {
  id: "s1",
  name: "Corte masculino",
  duration_minutes: 40,
  price_cents: 6000,
  effectiveDepositCents: 0,
  show_price: true,
  show_duration: true,
};

describe("BusinessHeader", () => {
  it("usa header_title para o nome do negócio, não a cor calculada automaticamente", () => {
    const markup = renderToStaticMarkup(
      createElement(BusinessHeader, {
        name: "Barbearia felipe",
        logoUrl: null,
        address: null,
        appearance,
      }),
    );
    expect(markup).toContain("color:#00ffcc");
    expect(markup).not.toContain("color:#ffffff");
  });
});

describe("ServiceSection", () => {
  it("usa service_name_text e service_price_text no estado normal do card", () => {
    const markup = renderToStaticMarkup(
      createElement(ServiceSection, {
        services: [service],
        onSelect: () => {},
        appearance,
        pageText: "#ffffff",
      }),
    );
    expect(markup).toContain("color:#11ee11");
    expect(markup).toContain("color:#eeaa11");
  });

  it("mostra um estado vazio quando não há serviços", () => {
    const markup = renderToStaticMarkup(
      createElement(ServiceSection, {
        services: [],
        onSelect: () => {},
        appearance,
        pageText: "#ffffff",
      }),
    );
    expect(markup).toContain("Nenhum serviço cadastrado ainda.");
  });
});
