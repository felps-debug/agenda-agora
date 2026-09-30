import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OutreachDesign } from "@/lib/outreach-design";
import { TemplateCanvas } from "./TemplateCanvas";

// Este projeto roda Vitest em ambiente "node" (sem jsdom/Testing Library), então os
// testes aqui cobrem a marcação estática resultante da interatividade (seleção, alças
// de resize, guias, nomes acessíveis) e não o gesto de pointer/touch em si — esse
// comportamento (arrastar, redimensionar, snap, teclado) foi validado manualmente no
// navegador, registrado em specs/007-editor-templates-wysiwyg/quickstart.md.

function design(overrides: Partial<OutreachDesign> = {}): OutreachDesign {
  return {
    version: 1,
    width: 1080,
    height: 1080,
    background: "#101828",
    layers: [
      {
        id: "text-1",
        type: "text",
        x: 100,
        y: 100,
        width: 400,
        height: 100,
        rotation: 0,
        opacity: 1,
        text: "Promoção",
        color: "#ffffff",
        font: "inter",
        fontSize: 48,
        fontWeight: "bold",
        align: "left",
      },
      {
        id: "icon-1",
        type: "icon",
        x: 600,
        y: 100,
        width: 80,
        height: 80,
        rotation: 0,
        opacity: 1,
        iconKey: "scissors",
        color: "#ffffff",
      },
    ],
    ...overrides,
  };
}

describe("TemplateCanvas", () => {
  it("renderiza estático (sem role=button nas camadas) quando as props de interação não são passadas", () => {
    const markup = renderToStaticMarkup(createElement(TemplateCanvas, { design: design() }));
    expect(markup).not.toContain('role="button"');
    expect(markup).not.toContain("Redimensionar pela borda");
  });

  it("expõe cada camada como alvo focável com nome acessível quando interativo", () => {
    const markup = renderToStaticMarkup(
      createElement(TemplateCanvas, {
        design: design(),
        selectedLayerIndex: null,
        onSelect: () => {},
        onChange: () => {},
      }),
    );
    expect(markup).toContain('aria-label="Texto: Promoção"');
    expect(markup).toContain('aria-label="Ícone: scissors"');
    expect(markup.match(/role="button"/g)).toHaveLength(2);
    expect(markup.match(/tabindex="0"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("mostra as 8 alças de resize e o contorno apenas na camada selecionada", () => {
    const markup = renderToStaticMarkup(
      createElement(TemplateCanvas, {
        design: design(),
        selectedLayerIndex: 0,
        onSelect: () => {},
        onChange: () => {},
      }),
    );
    expect(markup.match(/aria-label="Redimensionar pela borda/g)).toHaveLength(8);
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('aria-selected="false"');
  });

  it("não mostra alças de resize quando nenhuma camada está selecionada", () => {
    const markup = renderToStaticMarkup(
      createElement(TemplateCanvas, {
        design: design(),
        selectedLayerIndex: null,
        onSelect: () => {},
        onChange: () => {},
      }),
    );
    expect(markup).not.toContain("Redimensionar pela borda");
  });

  it("mantém a camada parcialmente fora da arte visível, com a borda exportável explícita (rect de fundo cobre 0..width/height)", () => {
    const d = design({
      layers: [
        {
          id: "edge",
          type: "text",
          x: -20,
          y: 1000,
          width: 200,
          height: 120,
          rotation: 0,
          opacity: 1,
          text: "Borda",
          color: "#ffffff",
          font: "inter",
          fontSize: 32,
          fontWeight: "normal",
          align: "left",
        },
      ],
    });
    const markup = renderToStaticMarkup(
      createElement(TemplateCanvas, {
        design: d,
        selectedLayerIndex: 0,
        onSelect: () => {},
        onChange: () => {},
      }),
    );
    expect(markup).toContain(`width="${d.width}"`);
    expect(markup).toContain(`height="${d.height}"`);
    expect(markup).toContain('aria-label="Texto: Borda"');
  });
});
