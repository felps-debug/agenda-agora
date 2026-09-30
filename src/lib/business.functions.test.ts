import { describe, expect, it } from "vitest";
import {
  assertBusinessOwner,
  buildBusinessProfileUpdate,
  mapBusinessUpdateError,
  resolveBusinessGreeting,
  resolveBusinessTimezone,
  updateBusinessProfileInput,
} from "./business.functions";

describe("assertBusinessOwner (autorização usada por updateBusinessProfile)", () => {
  it("rejeita usuário que não é owner_id do negócio", () => {
    expect(() => assertBusinessOwner(null)).toThrow(
      "Somente o dono pode editar os dados do negócio.",
    );
  });

  it("permite o dono do negócio", () => {
    expect(() => assertBusinessOwner({ owner_id: "user-dono" })).not.toThrow();
  });
});

describe("mapBusinessUpdateError (slug duplicado)", () => {
  it("rejeita slug duplicado com a mensagem de link público em uso", () => {
    const error = mapBusinessUpdateError({ code: "23505", message: "duplicate key value" });
    expect(error.message).toBe("Esse link público já está sendo usado por outro estabelecimento.");
  });

  it("repassa a mensagem original pra outros erros", () => {
    const error = mapBusinessUpdateError({ message: "falha inesperada" });
    expect(error.message).toBe("falha inesperada");
  });
});

describe("buildBusinessProfileUpdate", () => {
  it("atualiza somente a saudação sem sobrescrever os demais dados do negócio", () => {
    expect(buildBusinessProfileUpdate({ greeting: "Olá!" })).toEqual({ greeting: "Olá!" });
  });

  it("atualiza saudação e fuso horário no mesmo patch", () => {
    expect(buildBusinessProfileUpdate({ greeting: "Olá!", timezone: "America/Fortaleza" })).toEqual(
      { greeting: "Olá!", timezone: "America/Fortaleza" },
    );
  });

  it("permite limpar a saudação", () => {
    expect(buildBusinessProfileUpdate({ greeting: "" })).toEqual({ greeting: "" });
  });

  it("mantém os campos do formulário de negócio e converte campos opcionais vazios em null", () => {
    expect(
      buildBusinessProfileUpdate({
        name: "Barbearia",
        slug: "barbearia",
        category: "barbearia",
        phone: "",
        address: "Rua A",
      }),
    ).toEqual({
      name: "Barbearia",
      slug: "barbearia",
      category: "barbearia",
      phone: null,
      address: "Rua A",
    });
  });
});

describe("saudação do negócio", () => {
  it("aceita atualizar somente a saudação sem exigir os campos do perfil", () => {
    expect(
      updateBusinessProfileInput.parse({
        businessId: "11111111-1111-4111-8111-111111111111",
        greeting: "Olá, cliente!",
      }),
    ).toMatchObject({ greeting: "Olá, cliente!" });
  });

  it("usa a saudação legada enquanto o negócio ainda não tiver uma", () => {
    expect(resolveBusinessGreeting(null, "Bem-vindo!")).toBe("Bem-vindo!");
    expect(resolveBusinessGreeting(undefined, "Olá!")).toBe("Olá!");
  });

  it("prioriza a saudação do negócio após a migração", () => {
    expect(resolveBusinessGreeting("Boas-vindas!", "Saudação antiga")).toBe("Boas-vindas!");
    expect(resolveBusinessGreeting("", "Saudação antiga")).toBe("");
  });
});

describe("fuso horário do negócio", () => {
  it("prioriza o fuso salvo no negócio sobre o fuso legado de preferências", () => {
    expect(resolveBusinessTimezone("America/Sao_Paulo", "America/Fortaleza")).toBe(
      "America/Sao_Paulo",
    );
    expect(resolveBusinessTimezone("America/Manaus", "America/Recife")).toBe("America/Manaus");
  });

  it("usa o fuso legado quando o negócio ainda não tem valor", () => {
    expect(resolveBusinessTimezone(null, "America/Recife")).toBe("America/Recife");
  });
});
