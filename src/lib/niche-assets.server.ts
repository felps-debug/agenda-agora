import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Lê as artes de divulgação dos nichos direto do disco.
 *
 * Estrutura esperada em /public/templates:
 *   templates/<nicho>/templates-prontos/arquivo.png   -> arte pronta
 *   templates/<nicho>/fotos-de-servicos/arquivo.jpg   -> foto de serviço
 *
 * Basta soltar os arquivos nessas pastas: nada precisa ser cadastrado no código.
 * Se as pastas não existirem (ex.: ambiente de produção sem os arquivos), a
 * função devolve uma lista vazia e a tela mostra o estado vazio.
 */

const ASSET_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);
const TEMPLATE_DIR = "templates-prontos";
const PHOTO_DIR = "fotos-de-servicos";

export type NicheAssetKind = "template" | "foto";

export type NicheAsset = {
  id: string;
  title: string;
  kind: NicheAssetKind;
  /** Caminho público servido pelo app (ex.: /templates/barbearia/templates-prontos/arte.png). */
  image: string;
};

/** Título legível a partir do nome do arquivo ("combo-corte_barba.png" -> "Combo Corte Barba"). */
function titleFromFilename(filename: string) {
  const base = filename.replace(/\.[^.]+$/, "");
  const words = base
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.join(" ") || "Arte";
}

function readFolder(nicheId: string, folder: string, kind: NicheAssetKind): NicheAsset[] {
  const absolute = join(process.cwd(), "public", "templates", nicheId, folder);
  let entries: string[];
  try {
    if (!statSync(absolute).isDirectory()) return [];
    entries = readdirSync(absolute);
  } catch {
    return [];
  }

  return entries
    .filter((name) => !name.startsWith(".") && ASSET_EXTENSIONS.has(`.${name.split(".").pop()?.toLowerCase()}`))
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((name) => ({
      id: `${kind}-${name}`.replace(/[^a-zA-Z0-9._-]/g, "-"),
      title: titleFromFilename(name),
      kind,
      image: `/templates/${nicheId}/${folder}/${encodeURIComponent(name)}`,
    }));
}

/** Todas as artes de todos os nichos, indexadas por id do nicho. */
export function readNicheAssets(): Record<string, NicheAsset[]> {
  let niches: string[];
  try {
    const root = join(process.cwd(), "public", "templates");
    niches = readdirSync(root).filter((name) => {
      try {
        return statSync(join(root, name)).isDirectory() && name !== "nichos";
      } catch {
        return false;
      }
    });
  } catch {
    return {};
  }

  const result: Record<string, NicheAsset[]> = {};
  for (const nicheId of niches) {
    const assets = [
      ...readFolder(nicheId, TEMPLATE_DIR, "template"),
      ...readFolder(nicheId, PHOTO_DIR, "foto"),
    ];
    if (assets.length > 0) result[nicheId] = assets;
  }
  return result;
}
