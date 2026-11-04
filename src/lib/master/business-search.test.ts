import { describe, expect, it } from "vitest";
import { matchesBusinessSearch, normalizeSearchText } from "./business-search";

const barberia = {
  name: "Barberia Felip",
  ownerName: "Felipe Souza",
  phone: "11987654321",
};

const outra = {
  name: "Studio Juliana",
  ownerName: "Guilherme",
  phone: "11985492763",
};

describe("matchesBusinessSearch", () => {
  it("encontra pelo nome mesmo com busca em minúsculas", () => {
    expect(matchesBusinessSearch(barberia, "barberia felip")).toBe(true);
  });

  it("não casa com estabelecimentos diferentes quando a busca não tem números", () => {
    // Regressão: `phone.includes("")` fazia todo mundo casar com texto.
    expect(matchesBusinessSearch(outra, "barberia felip")).toBe(false);
    expect(matchesBusinessSearch(outra, "xyz")).toBe(false);
  });

  it("ignora acentos", () => {
    expect(matchesBusinessSearch({ name: "Barbearía São João" }, "barbearia sao joao")).toBe(true);
  });

  it("busca pelo nome do responsável", () => {
    expect(matchesBusinessSearch(barberia, "felipe")).toBe(true);
    expect(matchesBusinessSearch(outra, "felipe")).toBe(false);
  });

  it("busca pelo telefone somente com dígitos", () => {
    expect(matchesBusinessSearch(barberia, "98765")).toBe(true);
    expect(matchesBusinessSearch(barberia, "(11) 98765-4321")).toBe(true);
    expect(matchesBusinessSearch(outra, "98765")).toBe(false);
  });

  it("busca vazia retorna todos", () => {
    expect(matchesBusinessSearch(barberia, "")).toBe(true);
    expect(matchesBusinessSearch(barberia, "   ")).toBe(true);
  });

  it("normaliza texto", () => {
    expect(normalizeSearchText("Ação Ñ")).toBe("acao n");
  });
});
