import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCivilDate } from "./civil-date";

afterEach(() => vi.unstubAllEnvs());

describe("parseCivilDate", () => {
  it("keeps a YYYY-MM-DD chart key on that same local calendar day", () => {
    vi.stubEnv("TZ", "America/Fortaleza");
    const date = parseCivilDate("2026-11-13");

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(10);
    expect(date.getDate()).toBe(13);
  });
});
