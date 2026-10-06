import type { CSSProperties } from "react";
import type { Panel1Appearance } from "@/lib/panel1-config";

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return /^[0-9a-f]{6}$/i.test(value)
    ? `${parseInt(value.slice(0, 2), 16)} ${parseInt(value.slice(2, 4), 16)} ${parseInt(value.slice(4, 6), 16)}`
    : "37 99 235";
}

export function liquidGlassTokens(
  appearance: Panel1Appearance,
  pageBackground: string,
): CSSProperties {
  return {
    "--liquid-tint-rgb": hexToRgb(appearance.modal_active_background),
    "--liquid-atmosphere-rgb": hexToRgb(appearance.header_background),
    "--liquid-surface-rgb": hexToRgb(appearance.service_background),
    "--liquid-border-rgb": hexToRgb(appearance.service_border),
    "--liquid-page-rgb": hexToRgb(pageBackground),
  } as CSSProperties;
}

/** One filter definition per page; only hero surfaces use it. */
export function LiquidGlassFilterDefs() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute size-0 overflow-hidden">
      <defs>
        <filter id="agenda-liquid-glass-refraction" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.018"
            numOctaves="1"
            seed="8"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="9"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
