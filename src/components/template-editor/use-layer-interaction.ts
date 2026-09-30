import { useCallback, useRef, useState } from "react";
import type { OutreachDesign, OutreachDesignLayer } from "@/lib/outreach-design";

/** Limites persistidos em outreach-design.ts — mantidos em sincronia aqui de propósito. */
const MAX_COORD = 4000;
export const SNAP_THRESHOLD = 8;

export function clampCoord(value: number): number {
  return Math.min(MAX_COORD, Math.max(0, value));
}

export function clampSize(value: number): number {
  return Math.min(MAX_COORD, Math.max(1, value));
}

/** Converte um ponto de tela (clientX/clientY) para coordenadas da arte, corrigindo a escala do SVG responsivo. */
export function svgPointFromClient(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const inverse = ctm.inverse();
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(inverse);
  return { x: transformed.x, y: transformed.y };
}

export function moveLayer(layer: OutreachDesignLayer, dx: number, dy: number): OutreachDesignLayer {
  return { ...layer, x: clampCoord(layer.x + dx), y: clampCoord(layer.y + dy) };
}

export type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** Redimensiona por uma aresta/canto, mantendo o lado oposto fixo. Nunca gera width/height <= 0. */
export function resizeLayer(
  layer: OutreachDesignLayer,
  edge: ResizeEdge,
  dx: number,
  dy: number,
): OutreachDesignLayer {
  let { x, y, width, height } = layer;
  if (edge.includes("e")) {
    width = clampSize(width + dx);
  }
  if (edge.includes("w")) {
    const nextWidth = clampSize(width - dx);
    x = x + (width - nextWidth);
    width = nextWidth;
  }
  if (edge.includes("s")) {
    height = clampSize(height + dy);
  }
  if (edge.includes("n")) {
    const nextHeight = clampSize(height - dy);
    y = y + (height - nextHeight);
    height = nextHeight;
  }
  return { ...layer, x: clampCoord(x), y: clampCoord(y), width, height };
}

export type SnapGuide = { axis: "x" | "y"; position: number };

/**
 * Alinha o centro/bordas da camada ao centro/bordas da arte e das demais camadas, com
 * tolerância de SNAP_THRESHOLD (8px nativos). Custo O(n) por chamada (n = camadas).
 */
export function computeSnap(
  layer: OutreachDesignLayer,
  design: OutreachDesign,
  threshold = SNAP_THRESHOLD,
): { dx: number; dy: number; guides: SnapGuide[] } {
  const targetsX = [0, design.width / 2, design.width];
  const targetsY = [0, design.height / 2, design.height];
  for (const other of design.layers) {
    if (other.id === layer.id) continue;
    targetsX.push(other.x, other.x + other.width / 2, other.x + other.width);
    targetsY.push(other.y, other.y + other.height / 2, other.y + other.height);
  }

  const layerXs = [layer.x, layer.x + layer.width / 2, layer.x + layer.width];
  const layerYs = [layer.y, layer.y + layer.height / 2, layer.y + layer.height];

  let bestDx = 0;
  let bestDistX = Infinity;
  let guideX: number | null = null;
  for (const lx of layerXs) {
    for (const tx of targetsX) {
      const d = tx - lx;
      if (Math.abs(d) < Math.abs(bestDistX)) {
        bestDistX = d;
        bestDx = d;
        guideX = tx;
      }
    }
  }

  let bestDy = 0;
  let bestDistY = Infinity;
  let guideY: number | null = null;
  for (const ly of layerYs) {
    for (const ty of targetsY) {
      const d = ty - ly;
      if (Math.abs(d) < Math.abs(bestDistY)) {
        bestDistY = d;
        bestDy = d;
        guideY = ty;
      }
    }
  }

  const guides: SnapGuide[] = [];
  if (Math.abs(bestDistX) <= threshold && guideX !== null) {
    guides.push({ axis: "x", position: guideX });
  } else {
    bestDx = 0;
  }
  if (Math.abs(bestDistY) <= threshold && guideY !== null) {
    guides.push({ axis: "y", position: guideY });
  } else {
    bestDy = 0;
  }

  return { dx: bestDx, dy: bestDy, guides };
}

export type DragKind = { type: "move" } | { type: "resize"; edge: ResizeEdge };

type DragState = {
  layerIndex: number;
  kind: DragKind;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startLayer: OutreachDesignLayer;
};

/**
 * Hook de interação por Pointer Events (mouse + toque num único caminho) para arrastar e
 * redimensionar camadas diretamente no SVG. Usa setPointerCapture para não perder o
 * gesto quando o ponteiro sai da camada, e aplica snap a até 8px durante o movimento.
 */
export function useLayerInteraction({
  design,
  onChange,
  svgRef,
}: {
  design: OutreachDesign;
  onChange: (design: OutreachDesign) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}) {
  const dragRef = useRef<DragState | null>(null);
  const [guides, setGuides] = useState<SnapGuide[]>([]);

  const applyLayer = useCallback(
    (layerIndex: number, nextLayer: OutreachDesignLayer) => {
      onChange({
        ...design,
        layers: design.layers.map((layer, index) => (index === layerIndex ? nextLayer : layer)),
      });
    },
    [design, onChange],
  );

  const startDrag = useCallback(
    (layerIndex: number, kind: DragKind, event: React.PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const layer = design.layers[layerIndex];
      if (!layer) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        layerIndex,
        kind,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startLayer: layer,
      };
    },
    [design.layers, svgRef],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      const svg = svgRef.current;
      if (!drag || !svg || event.pointerId !== drag.pointerId) return;
      const start = svgPointFromClient(svg, drag.startClientX, drag.startClientY);
      const current = svgPointFromClient(svg, event.clientX, event.clientY);
      const dx = current.x - start.x;
      const dy = current.y - start.y;

      let nextLayer =
        drag.kind.type === "move"
          ? moveLayer(drag.startLayer, dx, dy)
          : resizeLayer(drag.startLayer, drag.kind.edge, dx, dy);

      const snap = computeSnap(nextLayer, design);
      if (snap.dx || snap.dy) {
        nextLayer = { ...nextLayer, x: clampCoord(nextLayer.x + snap.dx), y: nextLayer.y };
        nextLayer = { ...nextLayer, y: clampCoord(nextLayer.y + snap.dy) };
      }
      setGuides(snap.guides);
      applyLayer(drag.layerIndex, nextLayer);
    },
    [applyLayer, design, svgRef],
  );

  const endDrag = useCallback((event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    setGuides([]);
  }, []);

  /** Setas movem 1px; Shift+setas redimensiona pela aresta inferior/direita. Ignorado se o foco estiver num campo de edição. */
  const handleKeyDown = useCallback(
    (layerIndex: number, event: React.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const layer = design.layers[layerIndex];
      if (!layer) return;
      const step = 1;
      let nextLayer: OutreachDesignLayer | null = null;
      if (event.shiftKey) {
        if (event.key === "ArrowRight") nextLayer = resizeLayer(layer, "e", step, 0);
        else if (event.key === "ArrowLeft") nextLayer = resizeLayer(layer, "e", -step, 0);
        else if (event.key === "ArrowDown") nextLayer = resizeLayer(layer, "s", 0, step);
        else if (event.key === "ArrowUp") nextLayer = resizeLayer(layer, "s", 0, -step);
      } else {
        if (event.key === "ArrowRight") nextLayer = moveLayer(layer, step, 0);
        else if (event.key === "ArrowLeft") nextLayer = moveLayer(layer, -step, 0);
        else if (event.key === "ArrowDown") nextLayer = moveLayer(layer, 0, step);
        else if (event.key === "ArrowUp") nextLayer = moveLayer(layer, 0, -step);
      }
      if (!nextLayer) return;
      event.preventDefault();
      applyLayer(layerIndex, nextLayer);
    },
    [applyLayer, design.layers],
  );

  return {
    guides,
    startDrag,
    handlePointerMove,
    endDrag,
    handleKeyDown,
  };
}
