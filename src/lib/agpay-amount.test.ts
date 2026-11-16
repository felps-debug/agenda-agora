import { describe, expect, it } from "vitest";
import { agpayAmountToCents } from "./agpay-amount";

describe("agpayAmountToCents", () => {
  it.each([
    [100, 10_000],
    [100.5, 10_050],
    ["100.00", 10_000],
    ["0.01", 1],
    ["10", 1_000],
  ])("converte %s reais em centavos", (input, expected) => {
    expect(agpayAmountToCents(input)).toBe(expected);
  });

  it.each([undefined, null, "", "1.001", "R$ 10,00", -1, Infinity, "1e2"])(
    "recusa valor AgPay inválido: %s",
    (input) => {
      expect(agpayAmountToCents(input)).toBeNull();
    },
  );
});
