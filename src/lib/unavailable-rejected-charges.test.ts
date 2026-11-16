import { describe, expect, it } from "vitest";
import { unavailableRejectedChargesMetric } from "./unavailable-rejected-charges";

describe("unavailableRejectedChargesMetric", () => {
  it("never presents an unqueried charge metric as a confirmed zero", () => {
    expect(unavailableRejectedChargesMetric).toEqual({
      label: "Recusado",
      value: "—",
      hint: "Métrica não disponível",
    });
  });
});
