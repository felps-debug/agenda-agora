import { describe, expect, it } from "vitest";
import {
  evaluateAccountHealth,
  summarizeClients,
  summarizeDeposits,
  summarizeSetup,
  summarizeSubscription,
  summarizeUsage,
  type MasterAppointmentRow,
} from "@/lib/master/business-intelligence";

const NOW = new Date("2026-10-23T12:00:00.000Z");

function iso(daysFromNow: number) {
  return new Date(NOW.getTime() + daysFromNow * 86_400_000).toISOString();
}

function appointment(overrides: Partial<MasterAppointmentRow> = {}): MasterAppointmentRow {
  return {
    id: "appt-1",
    status: "agendado",
    starts_at: iso(-1),
    created_at: iso(-2),
    service_id: "svc-1",
    professional_id: "pro-1",
    customer_id: "cus-1",
    customer_name: "Cliente",
    customer_phone: "11999999999",
    ...overrides,
  };
}

describe("resumo de utilização", () => {
  it("conta agendamentos do período e separa cancelados do uso efetivo", () => {
    const result = summarizeUsage(
      [
        appointment({ id: "a", starts_at: iso(-2), status: "concluido" }),
        appointment({ id: "b", starts_at: iso(-3), status: "cancelado" }),
        appointment({ id: "c", starts_at: iso(-40), status: "concluido" }),
      ],
      [{ id: "svc-1", name: "Corte", price_cents: 5000 }],
      [{ id: "pro-1", name: "Ana" }],
      { now: NOW, periodDays: 30 },
    );
    expect(result.total).toBe(2);
    expect(result.usageCount).toBe(1);
    expect(result.canceled).toBe(1);
    expect(result.completed).toBe(1);
    expect(result.previousTotal).toBe(1);
    expect(result.completedAllTime).toBe(2);
  });

  it("não calcula variação quando o período anterior tem volume insuficiente", () => {
    const result = summarizeUsage([appointment({ id: "a", starts_at: iso(-1) })], [], [], {
      now: NOW,
      periodDays: 30,
    });
    expect(result.previousTotal).toBe(0);
    expect(result.variationPercent).toBeNull();
  });

  it("separa futuros dos já realizados", () => {
    const result = summarizeUsage(
      [
        appointment({ id: "futuro", starts_at: iso(5) }),
        appointment({ id: "passado", starts_at: iso(-5) }),
      ],
      [],
      [],
      { now: NOW, periodDays: 30 },
    );
    expect(result.future).toBe(1);
    expect(result.total).toBe(2);
    expect(result.usageCount).toBe(2);
  });

  it("não duplica agendamentos na série diária", () => {
    const result = summarizeUsage(
      [appointment({ id: "a", starts_at: iso(-1) }), appointment({ id: "b", starts_at: iso(-1) })],
      [],
      [],
      { now: NOW, periodDays: 7 },
    );
    const day = result.series.find((row) => row.date === iso(-1).slice(0, 10));
    expect(day?.count).toBe(2);
    expect(result.series).toHaveLength(7);
  });
});

describe("resumo de clientes", () => {
  it("trata cliente com mais de um agendamento como recorrente", () => {
    const clients = summarizeClients(
      [
        { id: "c1", name: "Ana", created_at: iso(-60) },
        { id: "c2", name: "Bia", created_at: iso(-5) },
      ],
      [
        appointment({ id: "a", customer_id: "c1" }),
        appointment({ id: "b", customer_id: "c1" }),
        appointment({ id: "c", customer_id: "c2" }),
      ],
      { now: NOW, periodDays: 30 },
    );
    expect(clients.total).toBe(2);
    expect(clients.newInPeriod).toBe(1);
    expect(clients.withAppointments).toBe(2);
    expect(clients.recurring).toBe(1);
    expect(clients.recurrenceRate).toBe(50);
  });

  it("não calcula taxa de retorno sem base de agendamentos", () => {
    const clients = summarizeClients([{ id: "c1", name: "Ana", created_at: iso(-60) }], [], {
      now: NOW,
      periodDays: 30,
    });
    expect(clients.withAppointments).toBe(0);
    expect(clients.recurrenceRate).toBeNull();
  });
});

describe("resumo de assinatura", () => {
  it("usa apenas pagamentos confirmados para o total pago", () => {
    const result = summarizeSubscription({
      monthlyFeeCents: 8990,
      payments: [
        {
          reference_month: "2026-10-01",
          status: "pago",
          amount_cents: 8990,
          paid_at: iso(-5),
          created_at: iso(-5),
        },
        {
          reference_month: "2026-09-01",
          status: "pendente",
          amount_cents: 8990,
          paid_at: null,
          created_at: iso(-35),
        },
      ],
      startedAt: iso(-90),
      now: NOW,
      isTrial: false,
    });
    expect(result.paidCount).toBe(1);
    expect(result.paidTotalCents).toBe(8990);
    expect(result.pendingCount).toBe(1);
    expect(result.currentStatus).toBe("pago");
    expect(result.nextChargeAt).toBeTruthy();
  });
});

describe("resumo de sinais Pix", () => {
  it("separa confirmados de pendentes e não soma taxa de pendência", () => {
    const result = summarizeDeposits([
      {
        id: "d1",
        status: "pago",
        amount_cents: 5000,
        net_amount_cents: 4900,
        gateway_fee_cents: 100,
        platform_commission_cents: 250,
        created_at: iso(-3),
        paid_at: iso(-3),
      },
      {
        id: "d2",
        status: "pendente",
        amount_cents: 3000,
        net_amount_cents: null,
        gateway_fee_cents: null,
        platform_commission_cents: null,
        created_at: iso(-1),
        paid_at: null,
      },
    ]);
    expect(result.paid).toBe(1);
    expect(result.pending).toBe(1);
    expect(result.paidVolumeCents).toBe(5000);
    expect(result.platformCommissionCents).toBe(250);
  });
});

describe("configuração inicial", () => {
  it("calcula o percentual de etapas concluídas", () => {
    const result = summarizeSetup({
      hasBasicData: true,
      servicesCount: 2,
      professionalsCount: 1,
      hasBusinessHours: false,
      hasPublicLink: true,
      usesReminders: false,
      usesWhatsapp: false,
      usesPix: false,
      hasReceivedAppointments: true,
    });
    expect(result.steps).toHaveLength(6);
    expect(result.percent).toBe(83);
  });
});

describe("saúde da conta", () => {
  const base = {
    hasUsageData: true,
    daysSinceLastAccess: 1,
    daysSinceLastAppointment: 1,
    periodAppointments: 10,
    previousPeriodAppointments: 10,
    daysSinceSignup: 120,
    setupPercent: 100,
    paymentStatus: "pago" as const,
    trialDaysRemaining: null,
  };

  it("classifica como saudável quando não há sinais de risco", () => {
    const result = evaluateAccountHealth(base);
    expect(result.status).toBe("saudavel");
    expect(result.score).toBe(100);
    expect(result.reasons).toHaveLength(0);
  });

  it("sem dados suficientes não devolve pontuação", () => {
    const result = evaluateAccountHealth({ ...base, hasUsageData: false });
    expect(result.status).toBe("sem_dados");
    expect(result.score).toBeNull();
  });

  it("aponta risco por inatividade longa", () => {
    const result = evaluateAccountHealth({ ...base, daysSinceLastAccess: 45 });
    expect(result.status).toBe("risco");
    expect(result.reasons.some((reason) => reason.code === "inativo_risco")).toBe(true);
  });

  it("aponta queda relevante de utilização", () => {
    const result = evaluateAccountHealth({
      ...base,
      periodAppointments: 3,
      previousPeriodAppointments: 10,
    });
    expect(result.reasons.some((reason) => reason.code === "queda_uso")).toBe(true);
  });

  it("aponta cobrança em aberto", () => {
    const result = evaluateAccountHealth({ ...base, paymentStatus: "pendente" });
    expect(result.reasons.some((reason) => reason.code === "cobranca_pendente")).toBe(true);
  });

  it("não marca risco por poucos agendamentos quando o histórico é curto", () => {
    const result = evaluateAccountHealth({
      ...base,
      periodAppointments: 1,
      previousPeriodAppointments: 1,
      daysSinceSignup: 3,
    });
    expect(result.reasons.some((reason) => reason.code === "queda_uso")).toBe(false);
  });
});
