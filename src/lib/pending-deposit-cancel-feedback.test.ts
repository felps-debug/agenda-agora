import { describe, expect, it } from "vitest";
import { getPendingDepositCancelFeedback } from "./pending-deposit-cancel-feedback";

describe("feedback do cancelamento do sinal", () => {
  it("só confirma cancelamento quando a cobrança expirou", () => {
    expect(getPendingDepositCancelFeedback("expirado")).toEqual({ kind: "cancelled" });
    expect(getPendingDepositCancelFeedback("pago")).toEqual({ kind: "paid" });
    expect(getPendingDepositCancelFeedback("pago_sem_agendamento")).toEqual({
      kind: "paid_unconfirmed",
    });
    expect(getPendingDepositCancelFeedback("pendente")).toEqual({ kind: "retry" });
  });
});
