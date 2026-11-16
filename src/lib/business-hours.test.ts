import { describe, expect, it } from "vitest";
import { validateBusinessHoursRange } from "./business-hours";

describe("business hours range validation", () => {
  it("rejects equal or earlier closing times", () => {
    expect(validateBusinessHoursRange("08:30", "08:30")).toBe("O fim deve ser depois do início.");
    expect(validateBusinessHoursRange("19:00", "08:30")).toBe("O fim deve ser depois do início.");
  });

  it("accepts a valid same-day interval", () => {
    expect(validateBusinessHoursRange("08:30", "19:00")).toBeNull();
  });
});
