import { useEffect, type CSSProperties } from "react";
import { accessibleTextColor, contrastRatio } from "@/lib/contrast";
import type { Panel1Appearance } from "@/lib/panel1-config";

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return /^[0-9a-f]{6}$/i.test(value)
    ? `${parseInt(value.slice(0, 2), 16)} ${parseInt(value.slice(2, 4), 16)} ${parseInt(value.slice(4, 6), 16)}`
    : "37 99 235";
}

const HEX = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i;

/** Mistura duas cores #RRGGBB; `amount` é a fatia de `b` (0 a 1). Cor inválida devolve `a`. */
export function mixHex(a: string, b: string, amount: number): string {
  const first = HEX.exec(a);
  const second = HEX.exec(b);
  if (!first || !second) return a;
  const channel = (index: number) =>
    Math.round(parseInt(first[index]!, 16) * (1 - amount) + parseInt(second[index]!, 16) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(1)}${channel(2)}${channel(3)}`;
}

/** Cor onde termina o degradê do fundo: derivada da paleta, não um azul-escuro fixo. */
export function liquidGlassPageEnd(pageBackground: string, appearance: Panel1Appearance): string {
  return mixHex(pageBackground, appearance.modal_active_background, 0.4);
}

/** Cor média do que aparece atrás do vidro da página (degradê + brilho branco do vidro). */
export function liquidGlassPageBase(pageBackground: string, appearance: Panel1Appearance): string {
  const gradient = mixHex(pageBackground, liquidGlassPageEnd(pageBackground, appearance), 0.5);
  return mixHex(gradient, "#ffffff", 0.1);
}

/** Cor média do diálogo: vidro da paleta sobre o escurecimento do overlay. */
export function liquidGlassDialogBase(
  pageBackground: string,
  appearance: Panel1Appearance,
): string {
  return mixHex(mixHex(pageBackground, appearance.header_background, 0.15), "#000000", 0.12);
}

const GLASS_TEXT_FIELDS = [
  "header_text",
  "header_title",
  "service_name_text",
  "service_price_text",
  "service_text",
] as const;

/**
 * Respeita as cores de texto da paleta, mas troca por preto/branco as que não leem sobre o vidro
 * (contraste WCAG abaixo de 4,5 contra a cor real atrás do texto).
 */
export function liquidGlassReadableAppearance(
  appearance: Panel1Appearance,
  base: string,
): Panel1Appearance {
  const fallback = accessibleTextColor(base);
  const next = { ...appearance };
  for (const field of GLASS_TEXT_FIELDS) {
    let readable = false;
    try {
      readable = contrastRatio(next[field], base) >= 4.5;
    } catch {
      readable = false;
    }
    if (!readable) next[field] = fallback;
  }
  return next;
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

type LiquidGlassHandle = { supported: boolean; refresh: () => void; destroy: () => void };

declare global {
  interface Window {
    liquidGlass?: (el: Element, opts?: Record<string, number | null>) => LiquidGlassHandle;
  }
}

// Acima disso o custo de GPU do filtro não compensa (recomendação do autor da lib).
const MAX_REFRACTION_SIZE = 800;
// Só elementos de tamanho estável (menu, capa do negócio, cards de serviço) recebem refração.
// Diálogos (fixos e roláveis) travaram a pintura, e cards que mudam de altura (histórico) deixavam
// o mapa desatualizado e geravam artefatos; esses ficam só com o vidro em CSS.
const SURFACE_SELECTOR = ".liquid-glass-refract:not(.liquid-glass-dialog)";

/**
 * Liga a refração real (liquid-glass.js, MIT) nas superfícies de vidro, inclusive nas que o
 * Radix renderiza em portais (diálogos). Safari/Firefox recebem o blur fosco da própria lib.
 */
function useLiquidGlassRefraction() {
  useEffect(() => {
    let disposed = false;
    const handles = new Map<Element, LiquidGlassHandle>();
    let observer: MutationObserver | null = null;

    const scan = () => {
      const lib = window.liquidGlass;
      if (!lib) return;
      for (const [el, handle] of handles) {
        if (!el.isConnected) {
          handle.destroy();
          handles.delete(el);
        }
      }
      document.querySelectorAll<HTMLElement>(SURFACE_SELECTOR).forEach((el) => {
        if (handles.has(el)) return;
        if (el.offsetWidth > MAX_REFRACTION_SIZE || el.offsetHeight > MAX_REFRACTION_SIZE) return;
        handles.set(el, lib(el, { scale: -90, chroma: 5, blur: 4, saturate: 1.4 }));
      });
    };

    void import("@/lib/vendor/liquid-glass.js").then(() => {
      if (disposed) return;
      scan();
      observer = new MutationObserver(scan);
      observer.observe(document.body, { childList: true, subtree: true });
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      handles.forEach((handle) => handle.destroy());
      handles.clear();
    };
  }, []);
}

/**
 * Estilo dos diálogos do Liquid Glass. O Radix os renderiza num portal fora da raiz da página, então
 * eles não herdam nada: levam tokens da paleta, a fonte do SaaS e os tokens de tema que os
 * componentes (Button, text-muted-foreground, bg-muted) leem, todos derivados da paleta.
 */
export function liquidGlassDialogStyle(
  appearance: Panel1Appearance,
  pageBackground: string,
  brandPrimary: string,
): CSSProperties {
  const text = accessibleTextColor(liquidGlassDialogBase(pageBackground, appearance));
  const tint = (percent: number) => `color-mix(in srgb, ${text} ${percent}%, transparent)`;
  return {
    ...liquidGlassTokens(appearance, pageBackground),
    fontFamily: "var(--font-sans)",
    color: text,
    "--foreground": text,
    "--card-foreground": text,
    "--background": "color-mix(in srgb, white 38%, transparent)",
    "--muted": tint(10),
    "--muted-foreground": tint(72),
    "--secondary": tint(12),
    "--secondary-foreground": text,
    "--accent": tint(16),
    "--accent-foreground": text,
    "--border": tint(22),
    "--input": tint(34),
    "--primary": brandPrimary,
    "--primary-foreground": accessibleTextColor(brandPrimary),
  } as CSSProperties;
}

/** One filter definition per page; only hero surfaces use it. */
export function LiquidGlassFilterDefs() {
  useLiquidGlassRefraction();
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
