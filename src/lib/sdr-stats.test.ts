import { describe, expect, it } from "vitest";
import { conversionRate, monthKey, percentChange, weeklyBuckets } from "./sdr-stats";

describe("sdr-stats", () => {
  it("monthKey formata ano-mês com dois dígitos", () => {
    expect(monthKey(new Date(2026, 0, 5))).toBe("2026-01");
    expect(monthKey(new Date(2026, 10, 27))).toBe("2026-11");
  });

  it("conversão = vendas ÷ cadastros", () => {
    expect(conversionRate(18, 10)).toBe(56);
    expect(conversionRate(12, 5)).toBe(42);
    expect(conversionRate(0, 0)).toBe(0);
  });

  it("percentChange retorna null sem base anterior", () => {
    expect(percentChange(12, 0)).toBeNull();
    expect(percentChange(12, 10)).toBe(20);
    expect(percentChange(5, 10)).toBe(-50);
  });

  it("weeklyBuckets cria janelas de 7 dias terminando hoje", () => {
    const today = new Date("2026-10-27T12:00:00Z");
    const buckets = weeklyBuckets(4, today);
    expect(buckets).toHaveLength(4);
    const first = buckets[0];
    const last = buckets[buckets.length - 1];
    if (!first || !last) throw new Error("buckets vazios");
    expect(last.label).toBe("21/10"); // hoje (27) - 6 dias
    const startFirst = new Date(first.start);
    const startLast = new Date(last.start);
    const days = Math.round((startLast.getTime() - startFirst.getTime()) / 86400000);
    expect(days).toBe(21);
  });
});
