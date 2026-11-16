import { describe, expect, it } from "vitest";
import { requireReportDatasets } from "./report-datasets";

const rows = <T>(data: T[] | null, error: { message: string } | null = null) => ({ data, error });

describe("requireReportDatasets", () => {
  it.each(["appointments", "services", "professionals"] as const)(
    "rejects a failed %s query instead of calculating partial metrics",
    (failedSource) => {
      const input = {
        appointments: rows([{ id: "a1" }]),
        services: rows([{ id: "s1" }]),
        professionals: rows([{ id: "p1" }]),
      };
      input[failedSource] = rows(null, { message: `${failedSource} unavailable` });

      expect(() => requireReportDatasets(input)).toThrow(`${failedSource} unavailable`);
    },
  );

  it("returns empty arrays for valid empty responses", () => {
    expect(
      requireReportDatasets({
        appointments: rows([]),
        services: rows([]),
        professionals: rows([]),
      }),
    ).toEqual({ appointments: [], services: [], professionals: [] });
  });
});
