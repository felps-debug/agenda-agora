import { useEffect, useRef, type CSSProperties } from "react";
import type { OutreachDesign, OutreachDesignLayer } from "@/lib/outreach-design";
import { loadOutreachFont, outreachFontFamily } from "./fonts";
import { TemplateIcon } from "./icons";
import { useLayerInteraction, type ResizeEdge } from "./use-layer-interaction";

const RESIZE_HANDLES: ResizeEdge[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function handlePosition(layer: OutreachDesignLayer, edge: ResizeEdge) {
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  const left = layer.x;
  const right = layer.x + layer.width;
  const top = layer.y;
  const bottom = layer.y + layer.height;
  switch (edge) {
    case "nw":
      return { x: left, y: top };
    case "n":
      return { x: cx, y: top };
    case "ne":
      return { x: right, y: top };
    case "e":
      return { x: right, y: cy };
    case "se":
      return { x: right, y: bottom };
    case "s":
      return { x: cx, y: bottom };
    case "sw":
      return { x: left, y: bottom };
    case "w":
      return { x: left, y: cy };
  }
}

function layerLabel(layer: OutreachDesignLayer): string {
  if (layer.type === "text") return `Texto: ${layer.text.slice(0, 40) || "vazio"}`;
  if (layer.type === "icon") return `Ícone: ${layer.iconKey}`;
  return `Forma: ${layer.shape}`;
}

export function TemplateCanvas({
  design,
  className,
  style,
  selectedLayerIndex,
  onSelect,
  onChange,
}: {
  design: OutreachDesign;
  className?: string;
  style?: CSSProperties;
  /** Quando informado junto com onSelect/onChange, o canvas vira interativo (clique, arrasto, teclado). */
  selectedLayerIndex?: number | null;
  onSelect?: (index: number | null) => void;
  onChange?: (design: OutreachDesign) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const interactive = onSelect !== undefined && onChange !== undefined;
  const { guides, startDrag, handlePointerMove, endDrag, handleKeyDown } = useLayerInteraction({
    design,
    onChange: onChange ?? (() => {}),
    svgRef,
  });

  useEffect(() => {
    for (const layer of design.layers) if (layer.type === "text") loadOutreachFont(layer.font);
  }, [design.layers]);

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${design.width} ${design.height}`}
      role="img"
      aria-label="Prévia da arte de divulgação"
      className={`touch-none select-none ${className ?? ""}`}
      style={style}
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerUp={interactive ? endDrag : undefined}
      onPointerCancel={interactive ? endDrag : undefined}
      onClick={interactive ? () => onSelect?.(null) : undefined}
    >
      <rect width={design.width} height={design.height} fill={design.background} />
      {design.backgroundImage && (
        <image
          href={design.backgroundImage}
          x={0}
          y={0}
          width={design.width}
          height={design.height}
          preserveAspectRatio="xMidYMid slice"
        />
      )}
      {design.layers.map((layer, index) => {
        const isSelected = interactive && selectedLayerIndex === index;
        const transform = layer.rotation
          ? `rotate(${layer.rotation} ${layer.x + layer.width / 2} ${layer.y + layer.height / 2})`
          : undefined;

        let content: React.ReactNode;
        if (layer.type === "icon") {
          content = <TemplateIcon layer={layer} />;
        } else if (layer.type === "shape") {
          const common = {
            fill: layer.shape === "line" ? "none" : layer.fill,
            stroke: layer.stroke,
            strokeWidth: layer.strokeWidth,
            opacity: layer.opacity,
            transform,
          };
          content =
            layer.shape === "circle" ? (
              <ellipse
                cx={layer.x + layer.width / 2}
                cy={layer.y + layer.height / 2}
                rx={layer.width / 2}
                ry={layer.height / 2}
                {...common}
              />
            ) : (
              <rect
                x={layer.x}
                y={layer.y}
                width={layer.width}
                height={layer.shape === "line" ? Math.max(1, layer.strokeWidth) : layer.height}
                rx={layer.radius}
                {...common}
              />
            );
        } else {
          const family = outreachFontFamily(layer.font);
          const lines = layer.text.split("\n");
          const anchor =
            layer.align === "left" ? "start" : layer.align === "right" ? "end" : "middle";
          const x =
            layer.align === "left"
              ? layer.x
              : layer.align === "right"
                ? layer.x + layer.width
                : layer.x + layer.width / 2;
          // Centraliza o bloco de texto verticalmente dentro da caixa da camada
          // (layer.height quase sempre sobra espaço vs. o texto real).
          const lineHeight = layer.fontSize * 1.2;
          const blockHeight = layer.fontSize + (lines.length - 1) * lineHeight;
          const firstLineY = layer.y + (layer.height - blockHeight) / 2 + layer.fontSize;
          content = (
            <text
              x={x}
              y={firstLineY}
              fill={layer.color}
              fontFamily={`'${family}', sans-serif`}
              fontSize={layer.fontSize}
              fontWeight={layer.fontWeight}
              textAnchor={anchor}
              opacity={layer.opacity}
              transform={transform}
            >
              {lines.map((line, lineIndex) => (
                <tspan
                  key={`${layer.id}-${lineIndex}`}
                  x={x}
                  dy={lineIndex === 0 ? 0 : layer.fontSize * 1.2}
                >
                  {line}
                </tspan>
              ))}
            </text>
          );
        }

        if (!interactive) return <g key={layer.id}>{content}</g>;

        return (
          <g
            key={layer.id}
            tabIndex={0}
            role="button"
            aria-label={layerLabel(layer)}
            aria-selected={isSelected}
            className="outline-none focus-visible:outline-none"
            onPointerDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
              onSelect?.(index);
              startDrag(index, { type: "move" }, event);
            }}
            onClick={(event) => event.stopPropagation()}
            onFocus={() => onSelect?.(index)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            style={{ cursor: "move" }}
          >
            {content}
            {isSelected && (
              <rect
                x={layer.x - 2}
                y={layer.y - 2}
                width={layer.width + 4}
                height={layer.height + 4}
                fill="none"
                stroke="#1677ff"
                strokeWidth={2}
                strokeDasharray="6 4"
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}

      {interactive &&
        selectedLayerIndex !== null &&
        selectedLayerIndex !== undefined &&
        design.layers[selectedLayerIndex] &&
        RESIZE_HANDLES.map((edge) => {
          const layer = design.layers[selectedLayerIndex]!;
          const { x, y } = handlePosition(layer, edge);
          const size = Math.max(10, Math.min(design.width, design.height) * 0.015);
          return (
            <rect
              key={edge}
              x={x - size / 2}
              y={y - size / 2}
              width={size}
              height={size}
              fill="#1677ff"
              stroke="#ffffff"
              strokeWidth={1}
              aria-label={`Redimensionar pela borda ${edge}`}
              style={{ cursor: `${edge}-resize` }}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.preventDefault();
                startDrag(selectedLayerIndex, { type: "resize", edge }, event);
              }}
              onClick={(event) => event.stopPropagation()}
            />
          );
        })}

      {interactive &&
        guides.map((guide, index) =>
          guide.axis === "x" ? (
            <line
              key={`gx-${index}`}
              x1={guide.position}
              y1={0}
              x2={guide.position}
              y2={design.height}
              stroke="#ff4d6d"
              strokeWidth={1}
              pointerEvents="none"
            />
          ) : (
            <line
              key={`gy-${index}`}
              x1={0}
              y1={guide.position}
              x2={design.width}
              y2={guide.position}
              stroke="#ff4d6d"
              strokeWidth={1}
              pointerEvents="none"
            />
          ),
        )}
    </svg>
  );
}
