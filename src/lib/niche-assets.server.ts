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
 *
 * Em dev os arquivos ficam em `<cwd>/public/templates`. No build Nitro/Docker o
 * runtime roda a partir de `.output` (o Dockerfile copia só `.output`), então os
 * mesmos assets ficam em `<cwd>/.output/public/templates`. Resolvemos a raiz
 * tentando os caminhos conhecidos para a listagem funcionar nos dois ambientes.
 */

const ASSET_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);
const TEMPLATE_DIR = "templates-prontos";
const PHOTO_DIR = "fotos-de-servicos";

/** Primeira raiz de `templates` que existir (dev: public/; prod Nitro: .output/public/). */
function resolveTemplatesRoot(): string | null {
  const candidates = [
    join(process.cwd(), "public", "templates"),
    join(process.cwd(), ".output", "public", "templates"),
  ];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isDirectory()) return candidate;
    } catch {
      // tenta a próxima
    }
  }
  return null;
}

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

function readFolder(root: string, nicheId: string, folder: string, kind: NicheAssetKind): NicheAsset[] {
  const absolute = join(root, nicheId, folder);
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
  const root = resolveTemplatesRoot();
  if (!root) return {};

  let niches: string[];
  try {
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
      ...readFolder(root, nicheId, TEMPLATE_DIR, "template"),
      ...readFolder(root, nicheId, PHOTO_DIR, "foto"),
    ];
    if (assets.length > 0) result[nicheId] = assets;
  }
  return result;
}
