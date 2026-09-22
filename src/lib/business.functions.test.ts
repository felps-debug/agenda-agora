import { describe, expect, it } from "vitest";
import { assertBusinessOwner, mapBusinessUpdateError } from "./business.functions";

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
