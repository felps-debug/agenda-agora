import { describe, expect, it } from "vitest";
import type { OutreachDesign, OutreachDesignLayer } from "@/lib/outreach-design";
import {
  SNAP_THRESHOLD,
  clampCoord,
  clampSize,
  computeSnap,
  moveLayer,
  resizeLayer,
  svgPointFromClient,
} from "./use-layer-interaction";

function textLayer(overrides: Partial<OutreachDesignLayer> = {}): OutreachDesignLayer {
  return {
    id: "l1",
    type: "text",
    x: 100,
    y: 100,
    width: 200,
    height: 60,
    rotation: 0,
    opacity: 1,
    text: "Olá",
    color: "#ffffff",
    font: "inter",
    fontSize: 32,
    fontWeight: "normal",
    align: "left",
    ...overrides,
  } as OutreachDesignLayer;
}

function design(layers: OutreachDesignLayer[]): OutreachDesign {
  return { version: 1, width: 1080, height: 1350, background: "#000000", layers };
}

describe("clampCoord / clampSize", () => {
  it("nunca deixa a posição sair de 0..4000", () => {
    expect(clampCoord(-50)).toBe(0);
    expect(clampCoord(5000)).toBe(4000);
    expect(clampCoord(200)).toBe(200);
  });

  it("nunca deixa o tamanho ser zero, negativo ou passar de 4000", () => {
    expect(clampSize(-10)).toBe(1);
    expect(clampSize(0)).toBe(1);
    expect(clampSize(5000)).toBe(4000);
    expect(clampSize(300)).toBe(300);
  });
});

describe("svgPointFromClient", () => {
  it("aplica a matriz inversa do SVG (tela escalada → coordenadas da arte)", () => {
    const inverse = { x: 0, y: 0 };
    const fakeMatrix = {
      inverse: () => fakeMatrix,
      // usado indiretamente por matrixTransform abaixo
    };
    const fakePoint = {
      x: 0,
      y: 0,
      matrixTransform() {
        // simula um SVG renderizado a 50% do tamanho nativo (viewBox 1080 -> tela 540)
        return { x: this.x * 2, y: this.y * 2 };
      },
    };
    const svg = {
      getScreenCTM: () => fakeMatrix,
      createSVGPoint: () => fakePoint,
    } as unknown as SVGSVGElement;

    const result = svgPointFromClient(svg, 270, 100);
    expect(result).toEqual({ x: 540, y: 200 });
    void inverse;
  });

  it("cai de volta em clientX/clientY quando getScreenCTM retorna null (SVG não montado)", () => {
    const svg = { getScreenCTM: () => null } as unknown as SVGSVGElement;
    expect(svgPointFromClient(svg, 10, 20)).toEqual({ x: 10, y: 20 });
  });
});

describe("moveLayer", () => {
  it("desloca x/y pelo delta informado", () => {
    const moved = moveLayer(textLayer({ x: 100, y: 100 }), 50, -30);
    expect(moved.x).toBe(150);
    expect(moved.y).toBe(70);
  });

  it("nunca deixa a camada sair de 0..4000", () => {
    const moved = moveLayer(textLayer({ x: 10, y: 3990 }), -100, 100);
    expect(moved.x).toBe(0);
    expect(moved.y).toBe(4000);
  });
});

describe("resizeLayer", () => {
  it("redimensiona pela borda leste sem mover x/y", () => {
    const resized = resizeLayer(textLayer({ x: 100, y: 100, width: 200, height: 60 }), "e", 50, 0);
    expect(resized).toMatchObject({ x: 100, y: 100, width: 250, height: 60 });
  });

  it("redimensiona pela borda oeste ajustando x para manter o lado direito fixo", () => {
    const resized = resizeLayer(textLayer({ x: 100, y: 100, width: 200, height: 60 }), "w", 50, 0);
    expect(resized.width).toBe(150);
    expect(resized.x).toBe(150);
  });

  it("nunca produz width/height zero ou negativo ao arrastar além do limite", () => {
    const resized = resizeLayer(
      textLayer({ x: 100, y: 100, width: 200, height: 60 }),
      "e",
      -500,
      0,
    );
    expect(resized.width).toBeGreaterThan(0);
    expect(resized.width).toBe(1);
  });

  it("redimensiona por canto (se) combinando largura e altura", () => {
    const resized = resizeLayer(
      textLayer({ x: 100, y: 100, width: 200, height: 60 }),
      "se",
      20,
      10,
    );
    expect(resized).toMatchObject({ x: 100, y: 100, width: 220, height: 70 });
  });
});

describe("computeSnap", () => {
  it("gera guia quando a camada fica a até 8px do centro da arte", () => {
    // design 1080 largura; centro = 540. Camada de largura 200 centrada em 540 -> x = 440.
    const layer = textLayer({ x: 444, y: 100, width: 200 });
    const { dx, guides } = computeSnap(layer, design([layer]), SNAP_THRESHOLD);
    expect(guides).toContainEqual({ axis: "x", position: 540 });
    expect(layer.x + dx + layer.width / 2).toBe(540);
  });

  it("não gera guia quando a distância excede o threshold", () => {
    const layer = textLayer({ x: 300, y: 100, width: 200 });
    const { dx, dy, guides } = computeSnap(layer, design([layer]), SNAP_THRESHOLD);
    expect(dx).toBe(0);
    expect(dy).toBe(0);
    expect(guides).toEqual([]);
  });

  it("alinha à borda de outra camada", () => {
    const anchor = textLayer({ id: "anchor", x: 500, y: 500, width: 100, height: 40 });
    const moving = textLayer({ id: "moving", x: 496, y: 200, width: 200, height: 40 });
    const { dx, guides } = computeSnap(moving, design([anchor, moving]), SNAP_THRESHOLD);
    expect(guides).toContainEqual({ axis: "x", position: 500 });
    expect(moving.x + dx).toBe(500);
  });
});
