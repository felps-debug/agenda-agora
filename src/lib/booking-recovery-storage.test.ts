import { describe, expect, it, vi } from "vitest";
import { appendRecoveryId } from "./booking-recovery-storage";

describe("appendRecoveryId", () => {
  it("returns the updated in-memory list even when browser storage is unavailable", () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error("storage disabled");
      }),
    };

    expect(appendRecoveryId(() => storage, "charges", "charge-2", ["charge-1"])).toEqual({
      ids: ["charge-2", "charge-1"],
      persisted: false,
    });
  });

  it("keeps the code available in memory when even the storage read throws", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("storage disabled");
      }),
      setItem: vi.fn(),
    };

    expect(appendRecoveryId(() => storage, "codes", "public-code", ["older-code"])).toEqual({
      ids: ["public-code", "older-code"],
      persisted: true,
    });
    expect(storage.setItem).toHaveBeenCalledOnce();
  });
});
