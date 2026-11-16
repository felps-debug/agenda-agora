import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdmin, serverFnMock } from "@/test-support/fake-admin";

const runtime = vi.hoisted(() => ({
  fake: null as null | ReturnType<typeof import("@/test-support/fake-admin").createFakeAdmin>,
}));

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/auth/require-super-admin", () => ({
  assertSuperAdmin: async () => runtime.fake!.client,
}));

const { getTransactions } = await import("./transactions.functions");
type Caller = (arg: { data: unknown; context: unknown }) => Promise<{
  deposits: unknown[];
  metrics: { totalDeposits: number; totalProcessedCents: number };
}>;
const getReport = getTransactions as unknown as Caller;
const master = { userId: "master-1", claims: {} };

beforeEach(() => {
  runtime.fake = createFakeAdmin({
    businesses: [{ id: "biz-1", name: "Barbearia", owner_id: "owner-1" }],
    profiles: [{ id: "owner-1", full_name: "Dono", email: "owner@example.com" }],
    deposit_payments: [],
    withdrawals: [],
  });
});

describe("getTransactions: erros e paginas completas", () => {
  it("propaga falha em vez de mostrar tabela e metricas vazias", async () => {
    runtime.fake!.failures["deposit_payments:select"] = { message: "falha de leitura" };
    await expect(getReport({ data: {}, context: master })).rejects.toThrow(
      "Não foi possível carregar as transações financeiras.",
    );
  });

  it("inclui todos os depositos e metricas acima do limite anterior de 2.000", async () => {
    runtime.fake!.tables["deposit_payments"] = Array.from({ length: 2001 }, (_, index) => ({
      id: `deposit-${index}`,
      business_id: "biz-1",
      amount_cents: 100,
      gateway_fee_cents: 0,
      platform_commission_cents: 0,
      net_amount_cents: 100,
      status: "pago",
      created_at: "2026-11-02T10:00:00Z",
      payer_email: "payer@example.com",
      payer_name: "Cliente",
    }));
    const result = await getReport({ data: {}, context: master });
    expect(result.deposits).toHaveLength(2001);
    expect(result.metrics).toMatchObject({ totalDeposits: 2001, totalProcessedCents: 200100 });
  });
});
