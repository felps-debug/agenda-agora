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

/**
 * Vidro fumê do Painel 1: base quase preta tingida pela cor de fundo da página (editável) e
 * luzes na cor de destaque da paleta (também editável). Com a paleta padrão fica o dourado
 * da referência.
 */
export function liquidGlassDark(pageBackground: string, appearance?: Panel1Appearance): string {
  // A cor principal dá o tom; o fundo da página só acrescenta um pouco.
  const seed = appearance
    ? mixHex(appearance.modal_active_background, pageBackground, 0.15)
    : pageBackground;
  return mixHex(seed, "#000000", 0.8);
}

/** Cor das luzes (fitas, reflexos e brilho): o destaque da paleta, clareado para brilhar no escuro. */
export function liquidGlassAccent(appearance: Panel1Appearance): string {
  return mixHex(appearance.modal_active_background, "#ffffff", 0.3);
}

const GOLD_HUE = 38; // matiz do dourado da referência (os reflexos do CSS são dourados)

/** Quantos graus girar os reflexos dourados do CSS para a cor de destaque. 0 se a cor for cinza. */
export function liquidGlassHueShift(accent: string): number {
  const match = HEX.exec(accent);
  if (!match) return 0;
  const [r, g, b] = [1, 2, 3].map((index) => parseInt(match[index]!, 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 0.05) return 0;
  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  return Math.round(hue - GOLD_HUE);
}

/** Fundo do Painel 1 (fitas de luz desfocadas): o SVG da referência com as luzes na cor da paleta. */
export function liquidGlassBackgroundImage(accent: string, dark: string): string {
  const light = (amount: number) => mixHex(accent, "#ffffff", amount);
  const shade = (amount: number) => mixHex(accent, "#000000", amount);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1600"><defs>' +
    '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    `<stop stop-color="${accent}" stop-opacity="0"/>` +
    `<stop offset=".48" stop-color="${light(0.15)}" stop-opacity=".2"/>` +
    `<stop offset=".65" stop-color="${light(0.85)}" stop-opacity=".48"/>` +
    `<stop offset=".82" stop-color="${shade(0.2)}" stop-opacity=".08"/>` +
    '<stop offset="1" stop-opacity="0"/></linearGradient>' +
    '<filter id="b"><feGaussianBlur stdDeviation="16"/></filter>' +
    '<filter id="s"><feGaussianBlur stdDeviation="2"/></filter>' +
    '<radialGradient id="p">' +
    `<stop stop-color="${light(0.93)}"/>` +
    `<stop offset=".12" stop-color="${light(0.65)}" stop-opacity=".9"/>` +
    `<stop offset=".35" stop-color="${shade(0.05)}" stop-opacity=".25"/>` +
    `<stop offset="1" stop-color="${shade(0.3)}" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="720" height="1600" fill="${dark}"/>` +
    '<g fill="none" stroke="url(#g)">' +
    '<path d="M-80 630C95 390 170 515 445 325S685 185 795-50" stroke-width="85" filter="url(#b)"/>' +
    '<path d="M-80 630C95 390 170 515 445 325S685 185 795-50" stroke-width="2" filter="url(#s)"/>' +
    '<path d="M-40 1030C70 800 205 685 465 585S670 495 770 390" stroke-width="62" filter="url(#b)"/>' +
    '<path d="M-40 1030C70 800 205 685 465 585S670 495 770 390" stroke-width="2" filter="url(#s)"/>' +
    '<path d="M-80 1590C180 1370 335 1420 560 1250S745 1180 810 940" stroke-width="95" filter="url(#b)"/></g>' +
    '<ellipse cx="171" cy="514" rx="70" ry="20" fill="url(#p)" transform="rotate(-28 171 514)"/>' +
    '<ellipse cx="607" cy="461" rx="38" ry="70" fill="url(#p)" opacity=".4" transform="rotate(25 607 461)"/></svg>';
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Cor onde termina o degradê do fundo: a base escura levemente tingida pela luz da paleta. */
export function liquidGlassPageEnd(pageBackground: string, appearance: Panel1Appearance): string {
  return mixHex(liquidGlassDark(pageBackground, appearance), liquidGlassAccent(appearance), 0.16);
}

/** Cor média do que aparece atrás do vidro da página (degradê escuro + um pouco de brilho). */
export function liquidGlassPageBase(pageBackground: string, appearance: Panel1Appearance): string {
  const gradient = mixHex(
    liquidGlassDark(pageBackground, appearance),
    liquidGlassPageEnd(pageBackground, appearance),
    0.5,
  );
  return mixHex(gradient, "#ffffff", 0.05);
}

/** Cor média do diálogo: vidro escuro sobre o escurecimento do overlay. */
export function liquidGlassDialogBase(
  pageBackground: string,
  appearance: Panel1Appearance,
): string {
  return mixHex(liquidGlassDark(pageBackground, appearance), "#000000", 0.1);
}

const GLASS_TEXT_FIELDS = [
  "page_text",
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
  // Creme da referência quando lê sobre a base escura; senão preto/branco.
  const cream = "#fff1c8";
  let creamReadable = false;
  try {
    creamReadable = contrastRatio(cream, base) >= 4.5;
  } catch {
    creamReadable = false;
  }
  const fallback = creamReadable ? cream : accessibleTextColor(base);
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
    "--liquid-tint-rgb": hexToRgb(liquidGlassAccent(appearance)),
    "--liquid-atmosphere-rgb": hexToRgb(
      mixHex(liquidGlassDark(pageBackground, appearance), liquidGlassAccent(appearance), 0.22),
    ),
    "--liquid-surface-rgb": hexToRgb(
      mixHex(liquidGlassDark(pageBackground, appearance), liquidGlassAccent(appearance), 0.38),
    ),
    "--liquid-border-rgb": hexToRgb(liquidGlassAccent(appearance)),
    "--liquid-page-rgb": hexToRgb(liquidGlassDark(pageBackground, appearance)),
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
    "--background": "color-mix(in srgb, white 10%, transparent)",
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
