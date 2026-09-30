import { describe, expect, it } from "vitest";
import { assertValidTimeBlockRange, validateTimeBlockRange } from "./time-blocks";

describe("validateTimeBlockRange", () => {
  it("requires the end to be later than the start", () => {
    expect(validateTimeBlockRange("10:00", "09:00")).toBe("O fim deve ser depois do início.");
    expect(validateTimeBlockRange("10:00", "10:00")).toBe("O fim deve ser depois do início.");
    expect(validateTimeBlockRange("10:00", "10:30")).toBeNull();
    expect(() => assertValidTimeBlockRange("10:00", "09:00")).toThrow(
      "O fim deve ser depois do início.",
    );
  });
});
