import { createServerFn } from "@tanstack/react-start";
import { readNicheAssets } from "./niche-assets.server";

/**
 * Lista as artes de divulgação disponíveis por nicho, lendo as pastas em
 * /public/templates/<nicho>/templates-prontos e .../fotos-de-servicos.
 * Não exige login: as artes são públicas.
 */
export const listNicheAssets = createServerFn({ method: "GET" }).handler(async () => {
  return readNicheAssets();
});
