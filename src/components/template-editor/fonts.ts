import { OUTREACH_FONTS } from "@/lib/outreach-design";

const fontFamilies: Record<(typeof OUTREACH_FONTS)[number], string> = {
  inter: "Inter",
  "playfair-display": "Playfair Display",
  montserrat: "Montserrat",
  poppins: "Poppins",
  lato: "Lato",
  roboto: "Roboto",
  oswald: "Oswald",
  merriweather: "Merriweather",
};

const loaded = new Set<string>();

/** Carrega somente a fonte escolhida, sem bloquear as demais telas. */
export function loadOutreachFont(font: (typeof OUTREACH_FONTS)[number]) {
  const family = fontFamilies[font];
  if (loaded.has(font) || typeof document === "undefined") return family;
  loaded.add(font);

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replaceAll("%20", "+")}:wght@400;500;600;700&display=swap`;
  document.head.append(link);
  return family;
}

export function outreachFontFamily(font: (typeof OUTREACH_FONTS)[number]) {
  return fontFamilies[font];
}
