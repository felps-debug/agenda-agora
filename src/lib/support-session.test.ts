import { afterEach, describe, expect, it, vi } from "vitest";
import {
  rememberFreshSupportSession,
  consumeFreshSupportSession,
  clearFreshSupportSession,
} from "./support-session";
afterEach(() => {
  clearFreshSupportSession();
  vi.useRealTimers();
});
describe("fresh support UI hint", () => {
  it("is one-use and only accepts the exact server-issued token", () => {
    rememberFreshSupportSession("issued");
    expect(consumeFreshSupportSession("other")).toBe(false);
    expect(consumeFreshSupportSession("issued")).toBe(true);
    expect(consumeFreshSupportSession("issued")).toBe(false);
  });
  it("expires quickly and clearing it forces normal server revalidation", () => {
    vi.useFakeTimers();
    rememberFreshSupportSession("issued");
    vi.advanceTimersByTime(30_001);
    expect(consumeFreshSupportSession("issued")).toBe(false);
    rememberFreshSupportSession("new");
    clearFreshSupportSession();
    expect(consumeFreshSupportSession("new")).toBe(false);
  });
});
