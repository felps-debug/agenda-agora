import { describe, expect, it } from "vitest";
import { nextDeleteConfirmation } from "./delete-confirmation";

describe("nextDeleteConfirmation", () => {
  it("mantém o alvo da confirmação quando a exclusão falha", () => {
    expect(nextDeleteConfirmation("service-1", "service-1", false)).toBe("service-1");
  });

  it("limpa o alvo somente depois da exclusão confirmada", () => {
    expect(nextDeleteConfirmation("service-1", "service-1", true)).toBeNull();
  });

  it("não fecha uma confirmação diferente após uma resposta atrasada", () => {
    expect(nextDeleteConfirmation("service-2", "service-1", true)).toBe("service-2");
  });
});
