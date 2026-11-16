import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  data: {
    deposits: [
      {
        id: "deposit-1",
        uuid: "deposit-uuid-1",
        clientName: "Cliente",
        email: "cliente@example.com",
        type: "PIX",
        grossCents: 10_000,
        netCents: 9_900,
        status: "pago",
        date: "2026-11-15T12:00:00.000Z",
        businessId: "business-1",
      },
    ],
    withdrawals: [],
    metrics: {
      totalDeposits: 1,
      totalWithdrawals: 0,
      pendingDeposits: 0,
      pendingWithdrawals: 0,
      totalProcessedCents: 9_900,
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: runtime.data,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/lib/master.functions", () => ({ requireMasterAccess: vi.fn() }));
vi.mock("@/lib/transactions.functions", () => ({ getTransactions: vi.fn() }));
vi.mock("@/components/master/BusinessDossier", () => ({ BusinessDossier: () => null }));
vi.mock("@/components/master/PlatformOverview", () => ({
  KpiCard: () => null,
  TONE_BLUE: { color: "blue", background: "blue", border: "blue", glow: "blue" },
  TONE_GREEN: { color: "green", background: "green", border: "green", glow: "green" },
  TONE_RED: { color: "red", background: "red", border: "red", glow: "red" },
  TONE_VIOLET: { color: "violet", background: "violet", border: "violet", glow: "violet" },
}));

const { Route } = await import("./painel.transacoes");

describe("colunas de valor nas transacoes Master", () => {
  it("identifica o valor exibido de netCents como valor liquido", () => {
    const Page = Route.options.component as React.ComponentType;
    const html = renderToStaticMarkup(React.createElement(Page));

    expect(html).toContain("Valor líquido");
    expect(html).not.toContain("Lucro Ag Pay");
  });
});
