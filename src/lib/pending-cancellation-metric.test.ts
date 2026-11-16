import { describe, expect, it } from "vitest";
import { pendingCancellationMetric } from "./pending-cancellation-metric";

describe("pendingCancellationMetric", () => {
  it("labels the aggregate as open requests, not a 30-day churn forecast", () => {
    expect(pendingCancellationMetric(4, 12500)).toEqual({
      label: "Pedidos de cancelamento em aberto",
      count: 4,
      monthlyCents: 12500,
    });
  });
});
