import { describe, expect, it } from "vitest";
import { classifyLifecycle, shouldAutoCancel } from "./subscription-lifecycle";

const base = {
  status: "ativo",
  isTrial: false,
  accessUntil: "2026-11-10T03:00:00.000Z",
  cancelRequestedAt: null as string | null,
  cancelledAt: null as string | null,
};

describe("classifyLifecycle", () => {
  it("assinante com acesso vigente", () => {
    const result = classifyLifecycle({ ...base, now: "2026-10-28T12:00:00.000Z" });
    expect(result.category).toBe("assinante");
    expect(result.daysLeft).toBe(13);
  });

  it("conta de teste com dias restantes = em teste (aviso com 3/1/0)", () => {
    const result = classifyLifecycle({
      ...base,
      isTrial: true,
      accessUntil: "2026-10-31T03:00:00.000Z",
      now: "2026-10-28T12:00:00.000Z",
    });
    expect(result.category).toBe("em_teste");
    expect(result.trialAlert).toBe(3);
  });

  it("teste no ultimo dia", () => {
    const result = classifyLifecycle({
      ...base,
      isTrial: true,
      accessUntil: "2026-10-28T03:00:00.000Z",
      now: "2026-10-28T12:00:00.000Z",
    });
    expect(result.category).toBe("em_teste");
    expect(result.trialAlert).toBe(0);
  });

  it("teste encerrado sem contratacao = teste expirado", () => {
    const result = classifyLifecycle({
      ...base,
      isTrial: true,
      accessUntil: "2026-10-26T03:00:00.000Z",
      now: "2026-10-28T12:00:00.000Z",
    });
    expect(result.category).toBe("atencao");
    expect(result.reason).toBe("teste_expirado");
  });

  it("1 a 3 dias apos o vencimento = pagamento pendente (tolerancia)", () => {
    const result = classifyLifecycle({ ...base, accessUntil: "2026-10-26T03:00:00.000Z", now: "2026-10-28T12:00:00.000Z" });
    expect(result.category).toBe("atencao");
    expect(result.reason).toBe("pagamento_pendente");
    expect(result.daysLate).toBe(2);
  });

  it("4 dia ou mais sem pagamento = assinatura vencida", () => {
    const result = classifyLifecycle({ ...base, accessUntil: "2026-10-24T03:00:00.000Z", now: "2026-10-28T12:00:00.000Z" });
    expect(result.category).toBe("atencao");
    expect(result.reason).toBe("assinatura_vencida");
    expect(result.daysLate).toBe(4);
  });

  it("conta suspensa = acesso suspenso", () => {
    const result = classifyLifecycle({
      ...base,
      status: "suspenso",
      accessUntil: "2026-11-10T03:00:00.000Z",
      now: "2026-10-28T12:00:00.000Z",
    });
    expect(result.category).toBe("atencao");
    expect(result.reason).toBe("acesso_suspenso");
  });

  it("cancelamento solicitado respeita o periodo pago (continua assinante)", () => {
    const result = classifyLifecycle({
      ...base,
      cancelRequestedAt: "2026-10-20T12:00:00.000Z",
      now: "2026-10-28T12:00:00.000Z",
    });
    expect(result.category).toBe("assinante");
  });

  it("cancelamento solicitado com acesso expirado = cancelamento solicitado", () => {
    const result = classifyLifecycle({
      ...base,
      cancelRequestedAt: "2026-10-20T12:00:00.000Z",
      accessUntil: "2026-10-24T03:00:00.000Z",
      now: "2026-10-28T12:00:00.000Z",
    });
    expect(result.category).toBe("atencao");
    expect(result.reason).toBe("cancelamento_solicitado");
  });

  it("cancelamento efetivado = cancelado", () => {
    const result = classifyLifecycle({
      ...base,
      cancelledAt: "2026-10-20T12:00:00.000Z",
      now: "2026-10-28T12:00:00.000Z",
    });
    expect(result.category).toBe("atencao");
    expect(result.reason).toBe("cancelado");
  });

  it("pagamento regularizado retorna para assinantes (vencimento rolante)", () => {
    const result = classifyLifecycle({
      ...base,
      accessUntil: "2026-11-27T03:00:00.000Z",
      now: "2026-10-28T12:00:00.000Z",
    });
    expect(result.category).toBe("assinante");
    expect(result.daysLeft).toBe(30);
  });
});

describe("shouldAutoCancel (regra do dia 15)", () => {
  const now = "2026-11-20T12:00:00.000Z";
  const overdue = (days: number) => new Date(Date.parse(now) - days * 86_400_000).toISOString();
  const input = (over: Partial<Parameters<typeof shouldAutoCancel>[0]> = {}) => ({
    autoCancelEnabled: true,
    isTrial: false,
    cancelledAt: null as string | null,
    accessUntil: overdue(15),
    now,
    ...over,
  });

  it("cancela somente com a chave ligada", () => {
    expect(shouldAutoCancel(input())).toBe(true);
    expect(shouldAutoCancel(input({ autoCancelEnabled: false }))).toBe(false);
  });

  it("14 dias de atraso ainda não cancela; 15 cancela", () => {
    expect(shouldAutoCancel(input({ accessUntil: overdue(14) }))).toBe(false);
    expect(shouldAutoCancel(input({ accessUntil: overdue(15) }))).toBe(true);
    expect(shouldAutoCancel(input({ accessUntil: overdue(40) }))).toBe(true);
  });

  it("conta em teste, já cancelada ou sem vencimento nunca é cancelada", () => {
    expect(shouldAutoCancel(input({ isTrial: true }))).toBe(false);
    expect(shouldAutoCancel(input({ cancelledAt: "2026-11-01T00:00:00Z" }))).toBe(false);
    expect(shouldAutoCancel(input({ accessUntil: null }))).toBe(false);
  });

  it("pagamento regularizado (vencimento no futuro) não cancela", () => {
    expect(shouldAutoCancel(input({ accessUntil: overdue(-30) }))).toBe(false);
  });
});
