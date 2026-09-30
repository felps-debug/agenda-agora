import { describe, expect, it } from "vitest";
import { completedReportMetrics } from "./report-metrics";

describe("completedReportMetrics", () => {
  it("ignora cancelados e mantém ranking e total coerentes com faturamento", () => {
    const metrics = completedReportMetrics(
      [
        { status: "cancelado", service_id: "corte", professional_id: "p1" },
        { status: "concluido", service_id: "corte", professional_id: "p1" },
        { status: "concluido", service_id: "corte", professional_id: "p1" },
      ],
      [{ id: "corte", name: "Corte", price_cents: 6000 }],
      [{ id: "p1", name: "João" }],
    );
    expect(metrics).toEqual({
      done: 2,
      revenue: 12000,
      byService: [{ name: "Corte", total: 2, valor: 12000 }],
      byProfessional: [{ name: "João", total: 2 }],
    });
  });
});
