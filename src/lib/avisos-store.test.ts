import { afterEach, describe, expect, it, vi } from "vitest";
import {
  avisoMarker,
  AVISOS_KEY,
  dismissAviso,
  readDismissed,
  shouldShowAviso,
  type AvisoStorage,
} from "./avisos-store";
import { dayKey } from "./day-key";
import { addDismissed, DISMISSED_KEY, readDismissedIds } from "./notifications-store";

const today = new Date(2026, 10, 8, 23, 59);
const tomorrow = new Date(2026, 10, 9);
function memory(): AvisoStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
afterEach(() => vi.useRealTimers());

describe("avisos dismissal", () => {
  it("uses the local calendar date, including midnight", () => {
    expect(dayKey(today)).toBe("2026-11-08");
    expect(dayKey(tomorrow)).toBe("2026-11-09");
  });
  it("markers change only when type, stage or local day changes", () => {
    expect(avisoMarker("cobranca", "urgente", today)).toBe("cobranca:urgente:2026-11-08");
    expect(avisoMarker("cobranca", "urgente", today)).toBe(
      avisoMarker("cobranca", "urgente", new Date(2026, 10, 8)),
    );
    expect(
      new Set([
        avisoMarker("cobranca", "urgente", today),
        avisoMarker("trial", "urgente", today),
        avisoMarker("cobranca", "atrasado", today),
        avisoMarker("cobranca", "urgente", tomorrow),
      ]).size,
    ).toBe(4);
  });
  it.each(["broadcast", "cobranca", "trial"] as const)(
    "persists %s across reads, allows new day/stage",
    (tipo) => {
      const storage = memory();
      dismissAviso(tipo, "business:urgente", today, storage);
      expect(shouldShowAviso(tipo, "business:urgente", today, storage)).toBe(false);
      expect(shouldShowAviso(tipo, "business:urgente", tomorrow, storage)).toBe(true);
      expect(shouldShowAviso(tipo, "other-business:urgente", today, storage)).toBe(true);
      expect(shouldShowAviso(tipo, "business:atrasado", today, storage)).toBe(true);
      expect(readDismissed(tipo, storage).size).toBe(1);
    },
  );
  it("retains at most 200 recent markers across types", () => {
    const storage = memory();
    for (let i = 0; i < 220; i++)
      dismissAviso(i % 2 ? "trial" : "cobranca", String(i), today, storage);
    expect(readDismissed(undefined, storage).size).toBe(200);
    expect(shouldShowAviso("trial", "219", today, storage)).toBe(false);
    expect(shouldShowAviso("cobranca", "0", today, storage)).toBe(true);
  });
  it("ignores corrupt storage and never throws on private mode/quota or SSR", () => {
    const storage = memory();
    for (const value of ["{", "null", "[]", '{"trial":[null,4,"wrong"]}']) {
      storage.setItem(AVISOS_KEY, value);
      expect(readDismissed(undefined, storage).size).toBe(0);
    }
    const broken = {
      getItem: () => {
        throw Error("blocked");
      },
      setItem: () => {
        throw Error("quota");
      },
    };
    expect(() => dismissAviso("trial", "ending", today, broken)).not.toThrow();
    expect(shouldShowAviso("trial", "ending", today, broken)).toBe(true);
    expect(() => dismissAviso("trial", "ending")).not.toThrow();
    expect(readDismissed().size).toBe(0);
  });
  it("migrates legacy broadcasts once and uses the common store afterwards", () => {
    vi.useFakeTimers();
    vi.setSystemTime(today);
    const storage = memory();
    storage.setItem(DISMISSED_KEY, JSON.stringify(["legacy"]));
    expect(readDismissedIds(storage).has("legacy")).toBe(true);
    addDismissed("new", storage);
    expect(shouldShowAviso("broadcast", "new", today, storage)).toBe(false);
    vi.setSystemTime(tomorrow);
    expect(readDismissedIds(storage).size).toBe(0);
  });
});
