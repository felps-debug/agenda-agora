import { describe, expect, it } from "vitest";
import { hasLedgerDivergence, parseObservedBalanceCents } from "./ledger-reconciliation";

describe("saldo observado no AgPay", () => {
  it.each([
    ["1.234,56", 123456],
    ["R$ 99,05", 9905],
    ["100", 10000],
    ["0,7", 70],
  ])("converte %s para centavos", (input, expected) => {
    expect(parseObservedBalanceCents(input)).toBe(expected);
  });

  it.each(["", "R$", "-12,00", "12,345", "1,2.3", "abc"])("recusa valor inválido: %s", (input) => {
    expect(parseObservedBalanceCents(input)).toBeNull();
  });

  it("sinaliza somente quando o saldo observado não cobre negócios e plataforma", () => {
    expect(hasLedgerDivergence(10000, 2500, 500, 1000, 13999)).toBe(true);
    expect(hasLedgerDivergence(10000, 2500, 500, 1000, 14001)).toBe(false);
    expect(hasLedgerDivergence(10000, 2500, 500, 1000, null)).toBe(false);
  });
});
