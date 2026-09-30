import type { OutreachDesign } from "@/lib/outreach-design";
import { loadOutreachFont, outreachFontFamily } from "./fonts";
import { TemplateCanvas } from "./TemplateCanvas";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

function svgMarkup(design: OutreachDesign, embeddedFonts: string) {
  return renderToStaticMarkup(createElement(TemplateCanvas, { design })).replace(
    /(<svg\b[^>]*>)/,
    `$1<style>${embeddedFonts}</style>`,
  );
}

async function embedFonts(design: OutreachDesign) {
  const fonts = [
    ...new Set(design.layers.filter((layer) => layer.type === "text").map((layer) => layer.font)),
  ];
  for (const font of fonts) loadOutreachFont(font);
  if (typeof document !== "undefined") await document.fonts.ready;
  const rules = await Promise.all(
    fonts.map(async (font) => {
      const family = outreachFontFamily(font);
      const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replaceAll("%20", "+")}:wght@400;500;600;700&display=swap`;
      const cssResponse = await fetch(cssUrl);
      if (!cssResponse.ok) throw new Error("Não foi possível carregar a fonte da arte.");
      const css = await cssResponse.text();
      const latin = css.match(/\/\* latin \*\/([\s\S]*?)(?:\n\})/);
      const source =
        latin?.[1]?.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1] ??
        [...css.matchAll(/url\((https:\/\/[^)]+\.woff2)\)/g)].at(-1)?.[1];
      if (!source) throw new Error("Não foi possível preparar a fonte para exportação.");
      const fontResponse = await fetch(source);
      if (!fontResponse.ok) throw new Error("Não foi possível preparar a fonte para exportação.");
      const bytes = new Uint8Array(await fontResponse.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      return `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${btoa(binary)}) format('woff2');font-style:normal;font-weight:400 700}`;
    }),
  );
  return rules.join("\n");
}

export async function exportOutreachPng(design: OutreachDesign): Promise<Blob> {
  const embeddedFonts = await embedFonts(design);
  const source = svgMarkup(design, embeddedFonts);
  const image = new Image();
  image.decoding = "async";
  image.src = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
  try {
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = design.width;
    canvas.height = design.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem.");
    context.drawImage(image, 0, 0, design.width, design.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Não foi possível gerar a imagem PNG.");
    return blob;
  } finally {
    URL.revokeObjectURL(image.src);
  }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadOutreachPng(design: OutreachDesign, filename: string) {
  const blob = await exportOutreachPng(design);
  triggerBlobDownload(blob, filename);
}

export type ShareOutreachResult = "shared" | "cancelled" | "downloaded";

export async function shareOutreachPng(
  design: OutreachDesign,
  filename: string,
): Promise<ShareOutreachResult> {
  // Artes com foto de fundo demoram mais pra gerar; nesse intervalo o navegador
  // pode "esquecer" que o clique ainda conta como gesto do usuário, e
  // navigator.share() rejeita mesmo com tudo certo. Cai pro download com o
  // mesmo PNG já gerado em vez de tentar de novo (e falhar de novo).
  const blob = await exportOutreachPng(design);
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      triggerBlobDownload(blob, filename);
      return "downloaded";
    }
  }
  triggerBlobDownload(blob, filename);
  return "downloaded";
}
