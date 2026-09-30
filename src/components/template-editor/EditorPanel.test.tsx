import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OutreachDesign } from "@/lib/outreach-design";
import { EditorPanel } from "./EditorPanel";

describe("EditorPanel", () => {
  it("destaca uma única camada e mostra nomes legíveis para fontes e ícones", () => {
    const design: OutreachDesign = {
      version: 1,
      width: 1080,
      height: 1080,
      background: "#101828",
      layers: [
        {
          id: "repeated-id",
          type: "text",
          x: 0,
          y: 0,
          width: 500,
          height: 100,
          rotation: 0,
          opacity: 1,
          text: "Título",
          color: "#ffffff",
          font: "playfair-display",
          fontSize: 48,
          fontWeight: "bold",
          align: "left",
        },
        {
          id: "repeated-id",
          type: "icon",
          x: 0,
          y: 120,
          width: 80,
          height: 80,
          rotation: 0,
          opacity: 1,
          iconKey: "scissors",
          color: "#ffffff",
        },
      ],
    };

    const markup = renderToStaticMarkup(
      createElement(EditorPanel, {
        design,
        selectedLayerIndex: 0,
        onChange: () => {},
        onSelect: () => {},
      }),
    );

    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(markup).toContain("Playfair Display");
    expect(markup).toContain("Tesoura");
    expect(markup).not.toContain(">playfair-display<");
    expect(markup).not.toContain(">scissors<");
  });

  it("mostra a dica de teclado e as alças de redimensionar da camada selecionada (US1)", () => {
    const design: OutreachDesign = {
      version: 1,
      width: 1080,
      height: 1080,
      background: "#101828",
      layers: [
        {
          id: "l1",
          type: "text",
          x: 100,
          y: 100,
          width: 400,
          height: 100,
          rotation: 0,
          opacity: 1,
          text: "Título",
          color: "#ffffff",
          font: "inter",
          fontSize: 48,
          fontWeight: "bold",
          align: "left",
        },
      ],
    };

    const markup = renderToStaticMarkup(
      createElement(EditorPanel, {
        design,
        selectedLayerIndex: 0,
        onChange: () => {},
        onSelect: () => {},
      }),
    );

    expect(markup).toContain("Arraste para mover");
    expect(markup).toContain("Shift+setas");
    expect(markup.match(/aria-label="Redimensionar pela borda/g)).toHaveLength(8);
  });

  it("expõe o seletor de ícones como grade pesquisável, não um <select> (US3)", () => {
    const design: OutreachDesign = {
      version: 1,
      width: 1080,
      height: 1080,
      background: "#101828",
      layers: [
        {
          id: "icon-1",
          type: "icon",
          x: 0,
          y: 0,
          width: 80,
          height: 80,
          rotation: 0,
          opacity: 1,
          iconKey: "scissors",
          color: "#ffffff",
        },
      ],
    };

    const markup = renderToStaticMarkup(
      createElement(EditorPanel, {
        design,
        selectedLayerIndex: 0,
        onChange: () => {},
        onSelect: () => {},
      }),
    );

    expect(markup).toContain('placeholder="Buscar ícone..."');
    expect(markup).not.toMatch(/<select[^>]*>[\s\S]*Tesoura[\s\S]*<\/select>/);
    // Ao menos as 20 opções de ícone aparecem como botões rotulados na grade.
    expect(markup.match(/aria-label="[^"]+"\s+aria-pressed/g)?.length ?? 0).toBeGreaterThanOrEqual(
      16,
    );
  });

  it("muda só o fundo ao editar a cor, sem alterar as camadas (US4)", () => {
    const design: OutreachDesign = {
      version: 1,
      width: 1080,
      height: 1080,
      background: "#101828",
      layers: [
        {
          id: "l1",
          type: "text",
          x: 100,
          y: 100,
          width: 400,
          height: 100,
          rotation: 0,
          opacity: 1,
          text: "Título",
          color: "#ffffff",
          font: "inter",
          fontSize: 48,
          fontWeight: "bold",
          align: "left",
        },
      ],
    };

    const markup = renderToStaticMarkup(
      createElement(EditorPanel, {
        design,
        selectedLayerIndex: null,
        onChange: () => {},
        onSelect: () => {},
      }),
    );

    expect(markup).toContain('type="color"');
    expect(markup).toContain("#101828");
  });
});
