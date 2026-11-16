import { afterEach, describe, expect, it, vi } from "vitest";
import { isInLocalMonth } from "./receivables-month";

afterEach(() => vi.unstubAllEnvs());

describe("isInLocalMonth", () => {
  it("uses local calendar month at the UTC month boundary", () => {
    vi.stubEnv("TZ", "America/Fortaleza");
    const paidAt = "2026-12-01T02:00:00.000Z"; // 30/11 23:00 em Fortaleza

    expect(isInLocalMonth(paidAt, 2026, 10)).toBe(true);
    expect(isInLocalMonth(paidAt, 2026, 11)).toBe(false);
  });
});
