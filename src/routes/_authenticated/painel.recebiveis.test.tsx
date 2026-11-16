import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  query: {
    data: undefined as unknown,
    isLoading: true,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => runtime.query }));
vi.mock("@/lib/master.functions", () => ({ requireMasterAccess: vi.fn() }));
vi.mock("@/lib/lifecycle.functions", () => ({ getReceivablesCalendar: vi.fn() }));

const { Route } = await import("./painel.recebiveis");
const Page = Route.options.component as React.ComponentType;

function render() {
  return renderToStaticMarkup(React.createElement(Page));
}

describe("painel de recebiveis", () => {
  it("does not render financial KPIs while the first query is loading", () => {
    runtime.query = {
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: true,
      refetch: vi.fn(),
    };

    const html = render();

    expect(html).toContain("Carregando recebíveis");
    expect(html).not.toContain("Recusado");
  });

  it("does not render financial KPIs when the calendar query fails", () => {
    runtime.query = {
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    };

    const html = render();

    expect(html).toContain("Os indicadores não estão disponíveis");
    expect(html).not.toContain("Recusado");
  });

  it("marks rejected charges unavailable after a valid empty response", () => {
    runtime.query = {
      data: { upcoming: [], received: [], churn: { count: 0, monthlyCents: 0 } },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    };

    const html = render();
    const rejectedCard = html.slice(html.indexOf("Recusado"), html.indexOf("Recusado") + 350);

    expect(rejectedCard).toContain(">—</p>");
    expect(rejectedCard).toContain("Métrica não disponível");
    expect(rejectedCard).not.toContain("R$ 0");
  });
});
