import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdmin, serverFnMock } from "@/test-support/fake-admin";

const runtime = vi.hoisted(() => ({
  fake: null as null | ReturnType<typeof import("@/test-support/fake-admin").createFakeAdmin>,
}));

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => {
  const wrap = (table: string) => {
    const query = runtime.fake!.client.from(table) as unknown as Record<string, unknown>;
    // O fake não implementa filtros de período; o teste fornece só linhas do período.
    for (const name of ["gte", "lte"]) query[name] = () => query;
    return query;
  };
  return { supabaseAdmin: { from: wrap } };
});

await import("@/integrations/supabase/client.server");
const { getAgpayPerformance } = await import("./agpay-performance.functions");
const run = getAgpayPerformance as unknown as (arg: {
  data: unknown;
  context: unknown;
}) => Promise<{
  kpi: {
    estimatedProfitCents: number;
    revenueCents: number;
    signalCount: number;
    gatewayFeeCents: number;
  };
  daily: Array<{ date: string; profitCents: number }>;
  businesses: Array<{ businessId: string; profitCents: number }>;
}>;

const master = { userId: "master-1", claims: {} };
const period = { from: "2026-11-01T00:00:00Z", to: "2026-11-30T23:59:59Z" };

beforeEach(() => {
  runtime.fake = createFakeAdmin({
    user_roles: [{ user_id: "master-1", role: "super_admin" }],
    businesses: [
      { id: "b1", name: "Barbearia 1", owner_id: "o1" },
      { id: "b2", name: "Salão 2", owner_id: "o2" },
    ],
    profiles: [
      { id: "o1", full_name: "Dono 1" },
      { id: "o2", full_name: "Dono 2" },
    ],
    deposit_payments: [
      {
        id: "d1",
        business_id: "b1",
        amount_cents: 3000,
        status: "pago",
        gateway_fee_cents: 75,
        platform_commission_cents: 150,
        paid_at: "2026-11-02T10:00:00Z",
        created_at: "2026-11-02T10:00:00Z",
      },
      {
        id: "d2",
        business_id: "b1",
        amount_cents: 5000,
        status: "pago",
        gateway_fee_cents: 75,
        platform_commission_cents: 250,
        paid_at: "2026-11-02T12:00:00Z",
        created_at: "2026-11-02T12:00:00Z",
      },
      {
        id: "d3",
        business_id: "b2",
        amount_cents: 4000,
        status: "pago",
        gateway_fee_cents: 75,
        platform_commission_cents: 200,
        paid_at: "2026-11-03T09:00:00Z",
        created_at: "2026-11-03T09:00:00Z",
      },
      // pendente: aparece na lista, mas não conta no lucro
      {
        id: "d4",
        business_id: "b2",
        amount_cents: 9000,
        status: "pendente",
        gateway_fee_cents: 0,
        platform_commission_cents: 450,
        paid_at: null,
        created_at: "2026-11-03T11:00:00Z",
      },
    ],
    withdrawals: [],
  });
});

describe("performance da carteira: lucro vem do ledger (US5)", () => {
  it("o lucro é exatamente a soma de platform_commission_cents das cobranças pagas do período", async () => {
    const result = await run({ data: period, context: master });
    expect(result.kpi.estimatedProfitCents).toBe(150 + 250 + 200);
    expect(result.kpi.revenueCents).toBe(600);
    expect(result.kpi.signalCount).toBe(3);
  });

  it("não subtrai a tarifa do gateway nem usa taxas configuradas no navegador", async () => {
    const result = await run({ data: period, context: master });
    expect(result.kpi.gatewayFeeCents).toBe(225);
    expect(result.kpi.estimatedProfitCents).not.toBe(600 - 225);
  });

  it("a soma por dia e por estabelecimento bate com o total", async () => {
    const result = await run({ data: period, context: master });
    expect(result.daily.reduce((sum, day) => sum + day.profitCents, 0)).toBe(600);
    expect(result.businesses.reduce((sum, b) => sum + b.profitCents, 0)).toBe(600);
  });

  it("dono comum não acessa", async () => {
    runtime.fake!.tables["user_roles"] = [{ user_id: "dono-1", role: "owner" }];
    await expect(run({ data: period, context: { userId: "dono-1", claims: {} } })).rejects.toThrow(
      "Acesso restrito ao painel master.",
    );
  });
});
