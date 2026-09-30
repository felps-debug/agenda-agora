const HEX_COLOR = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i;

function linearizeSrgbChannel(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Calcula a luminância relativa WCAG de uma cor sRGB hexadecimal opaca. */
export function relativeLuminance(color: string): number {
  const match = HEX_COLOR.exec(color);
  if (!match) throw new Error("Informe uma cor hexadecimal no formato #RRGGBB.");

  const red = Number.parseInt(match[1]!, 16);
  const green = Number.parseInt(match[2]!, 16);
  const blue = Number.parseInt(match[3]!, 16);
  return (
    0.2126 * linearizeSrgbChannel(red) +
    0.7152 * linearizeSrgbChannel(green) +
    0.0722 * linearizeSrgbChannel(blue)
  );
}

/** Retorna a razão de contraste WCAG entre duas cores sRGB opacas. */
export function contrastRatio(firstColor: string, secondColor: string): number {
  const first = relativeLuminance(firstColor);
  const second = relativeLuminance(secondColor);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** Escolhe entre preto e branco o texto com maior contraste contra o fundo. */
export function accessibleTextColor(backgroundColor: string): "#000000" | "#ffffff" {
  const luminance = relativeLuminance(backgroundColor);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  return contrastWithBlack >= contrastWithWhite ? "#000000" : "#ffffff";
}
