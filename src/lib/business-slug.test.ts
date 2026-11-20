import { describe, expect, it } from "vitest";
import { baseSlugFromName, uniqueBusinessSlug } from "./business-slug";

describe("slug do estabelecimento", () => {
  it("gera o slug limpo do nome, sem sufixo aleatório", async () => {
    expect(await uniqueBusinessSlug("Leticia Nails", async () => false)).toBe("leticia-nails");
    expect(baseSlugFromName("Barbearia do Zé & Cia!")).toBe("barbearia-do-ze-cia");
  });

  it("acrescenta número só quando o slug já existe", async () => {
    const used = new Set(["leticia-nails", "leticia-nails-2"]);
    expect(await uniqueBusinessSlug("Leticia Nails", async (s) => used.has(s))).toBe(
      "leticia-nails-3",
    );
  });

  it("não usa nomes reservados de rota", async () => {
    expect(await uniqueBusinessSlug("Painel", async () => false)).toBe("painel-2");
  });

  it("cai em 'negocio' quando o nome não tem letras ou números", async () => {
    expect(await uniqueBusinessSlug("!!!", async () => false)).toBe("negocio");
  });
});
