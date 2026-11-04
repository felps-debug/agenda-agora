import { describe, expect, it } from "vitest";
import {
  computeAccessCycle,
  computeInvoiceStatus,
  nextAccessAfterPayment,
  subscriptionTotalCents,
} from "./billing-cycle";

describe("computeAccessCycle", () => {
  it("acesso vigente = ok", () => {
    const cycle = computeAccessCycle({ accessUntil: "2026-11-10T03:00:00.000Z", now: "2026-10-28T12:00:00.000Z" });
    expect(cycle.stage).toBe("ok");
    expect(cycle.daysLeft).toBe(13);
  });

  it("1 dia antes = amanha", () => {
    const cycle = computeAccessCycle({ accessUntil: "2026-10-29T03:00:00.000Z", now: "2026-10-28T12:00:00.000Z" });
    expect(cycle.stage).toBe("amanha");
  });

  it("no dia = venceu_hoje", () => {
    const cycle = computeAccessCycle({ accessUntil: "2026-10-28T03:00:00.000Z", now: "2026-10-28T12:00:00.000Z" });
    expect(cycle.stage).toBe("venceu_hoje");
  });

  it("1 dia apos = atrasado", () => {
    const cycle = computeAccessCycle({ accessUntil: "2026-10-27T03:00:00.000Z", now: "2026-10-28T12:00:00.000Z" });
    expect(cycle.stage).toBe("atrasado");
  });

  it("2 e 3 dias apos = urgente", () => {
    expect(computeAccessCycle({ accessUntil: "2026-10-26T03:00:00.000Z", now: "2026-10-28T12:00:00.000Z" }).stage).toBe("urgente");
    expect(computeAccessCycle({ accessUntil: "2026-10-25T03:00:00.000Z", now: "2026-10-28T12:00:00.000Z" }).stage).toBe("urgente");
  });

  it("4 dia apos = bloqueado (painel travado)", () => {
    const cycle = computeAccessCycle({ accessUntil: "2026-10-24T03:00:00.000Z", now: "2026-10-28T12:00:00.000Z" });
    expect(cycle.stage).toBe("bloqueado");
  });
});

describe("computeInvoiceStatus", () => {
  it("a vencer visivel exatamente 10 dias antes", () => {
    const status = computeInvoiceStatus("2026-11-07T03:00:00.000Z", "2026-10-28T12:00:00.000Z");
    expect(status.status).toBe("a_vencer");
    expect(status.daysLeft).toBe(10);
    expect(status.visible).toBe(true);
  });

  it("a vencer invisivel fora da janela de 10 dias", () => {
    const status = computeInvoiceStatus("2026-11-08T03:00:00.000Z", "2026-10-28T12:00:00.000Z");
    expect(status.daysLeft).toBe(11);
    expect(status.visible).toBe(false);
  });

  it("vencida sempre visivel com dias de atraso", () => {
    const status = computeInvoiceStatus("2026-10-26T03:00:00.000Z", "2026-10-28T12:00:00.000Z");
    expect(status.status).toBe("vencida");
    expect(status.daysLeft).toBe(-2);
    expect(status.visible).toBe(true);
  });
});

describe("nextAccessAfterPayment", () => {
  it("pagando antecipado soma 30 dias AO FIM do acesso vigente (nao come dias)", () => {
    // Acesso ate 07/11, paga em 28/10: novo vencimento = 07/12 (10 restantes + 30).
    const next = nextAccessAfterPayment("2026-11-07T03:00:00.000Z", "2026-10-28T12:00:00.000Z");
    expect(new Date(next).getDate()).toBe(7);
    expect(new Date(next).getMonth()).toBe(11);
  });

  it("pagando atrasado o vencimento passa a ser pagamento + 30 dias", () => {
    // Venceu 25/10, ficou 4 dias sem usar e pagou 29/10: novo vencimento = 28/11.
    const next = nextAccessAfterPayment("2026-10-25T03:00:00.000Z", "2026-10-29T12:00:00.000Z");
    expect(new Date(next).getDate()).toBe(28);
    expect(new Date(next).getMonth()).toBe(10);
  });

  it("pagando no dia do vencimento renova 30 dias", () => {
    const next = nextAccessAfterPayment("2026-11-28T03:00:00.000Z", "2026-11-28T12:00:00.000Z");
    expect(new Date(next).getDate()).toBe(28);
    expect(new Date(next).getMonth()).toBe(11);
  });
});

describe("subscriptionTotalCents", () => {
  it("1 profissional (principal) = apenas o valor base", () => {
    expect(subscriptionTotalCents(8990, 1)).toBe(8990);
  });
  it("sem profissional cadastrado = apenas o valor base", () => {
    expect(subscriptionTotalCents(8990, 0)).toBe(8990);
  });
  it("3 profissionais = base + 2 adicionais de R$ 10", () => {
    expect(subscriptionTotalCents(8990, 3)).toBe(10990);
  });
  it("10 profissionais (limite) = base + 9 adicionais", () => {
    expect(subscriptionTotalCents(8990, 10)).toBe(17990);
  });
});
