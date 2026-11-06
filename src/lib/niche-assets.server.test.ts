import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Testa o loader de artes por nicho (US1). Mocka `node:fs` para simular a
 * estrutura em public/templates/<nicho>/{templates-prontos,fotos-de-servicos}/
 * sem depender do conteúdo real do disco.
 */

type FsNode = { dir: boolean; entries?: string[] };

const runtime = vi.hoisted(() => ({
  tree: new Map<string, FsNode>(),
}));

vi.mock("node:fs", () => ({
  statSync: (p: string) => {
    const node = runtime.tree.get(normalize(p));
    if (!node) {
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      throw err;
    }
    return { isDirectory: () => node.dir };
  },
  readdirSync: (p: string) => {
    const node = runtime.tree.get(normalize(p));
    if (!node || !node.dir) {
      const err = new Error("ENOTDIR") as NodeJS.ErrnoException;
      err.code = "ENOTDIR";
      throw err;
    }
    return node.entries ?? [];
  },
}));

function normalize(p: string) {
  return p.replace(/\\/g, "/");
}

/** Monta a árvore relativa a <cwd>/public/templates. */
function setTree(spec: Record<string, { "templates-prontos"?: string[]; "fotos-de-servicos"?: string[] } | "leaf-dir">) {
  const root = normalize(`${process.cwd()}/public/templates`);
  runtime.tree.clear();
  runtime.tree.set(root, { dir: true, entries: Object.keys(spec) });
  for (const [niche, folders] of Object.entries(spec)) {
    runtime.tree.set(`${root}/${niche}`, { dir: true });
    if (folders === "leaf-dir") continue;
    for (const [folder, files] of Object.entries(folders)) {
      runtime.tree.set(`${root}/${niche}/${folder}`, { dir: true, entries: files });
    }
  }
}

const { readNicheAssets } = await import("./niche-assets.server");

afterEach(() => {
  runtime.tree.clear();
});

describe("readNicheAssets (US1)", () => {
  it("lê artes de templates-prontos (template) e fotos-de-servicos (foto)", () => {
    setTree({
      barbearia: {
        "templates-prontos": ["combo-corte_barba.png"],
        "fotos-de-servicos": ["degrade.jpg"],
      },
    });
    const result = readNicheAssets();
    expect(result.barbearia).toHaveLength(2);
    const template = result.barbearia.find((a) => a.kind === "template");
    const foto = result.barbearia.find((a) => a.kind === "foto");
    expect(template).toMatchObject({
      kind: "template",
      title: "Combo Corte Barba",
      image: "/templates/barbearia/templates-prontos/combo-corte_barba.png",
    });
    expect(foto).toMatchObject({
      kind: "foto",
      image: "/templates/barbearia/fotos-de-servicos/degrade.jpg",
    });
  });

  it("ignora a pasta de capas 'nichos'", () => {
    setTree({
      nichos: { "templates-prontos": ["barbearia.png"] },
      lash: { "templates-prontos": ["volume.png"] },
    });
    const result = readNicheAssets();
    expect(result.nichos).toBeUndefined();
    expect(result.lash).toHaveLength(1);
  });

  it("ignora nicho sem nenhuma pasta/arte (estado vazio só quando vazio de fato)", () => {
    setTree({
      vazio: "leaf-dir",
      manicure: { "fotos-de-servicos": ["nail.webp"] },
    });
    const result = readNicheAssets();
    expect(result.vazio).toBeUndefined();
    expect(result.manicure).toHaveLength(1);
  });

  it("aceita extensões válidas e ignora arquivos não-imagem e dotfiles", () => {
    setTree({
      estetica: {
        "templates-prontos": [
          "arte.png",
          "arte.JPG",
          "arte.jpeg",
          "arte.webp",
          "arte.avif",
          "leia-me.txt",
          "arquivo.pdf",
          ".DS_Store",
        ],
      },
    });
    const result = readNicheAssets();
    expect(result.estetica).toHaveLength(5);
    expect(result.estetica.every((a) => a.kind === "template")).toBe(true);
  });

  it("devolve {} quando a raiz public/templates não existe", () => {
    runtime.tree.clear();
    expect(readNicheAssets()).toEqual({});
  });
});
