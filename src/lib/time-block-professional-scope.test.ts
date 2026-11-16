import { describe, expect, it } from "vitest";
import { canCreateTimeBlock } from "./time-block-professional-scope";

describe("time block professional scope", () => {
  it("blocks creation while the team query is pending or failed", () => {
    expect(canCreateTimeBlock({ isLoading: true, isError: false, professionalsCount: 2 })).toBe(
      false,
    );
    expect(canCreateTimeBlock({ isLoading: false, isError: true, professionalsCount: 0 })).toBe(
      false,
    );
  });

  it("requires an explicit scope when the business has multiple professionals", () => {
    expect(canCreateTimeBlock({ isLoading: false, isError: false, professionalsCount: 2 })).toBe(
      false,
    );
    expect(
      canCreateTimeBlock({
        isLoading: false,
        isError: false,
        professionalsCount: 2,
        professionalId: null,
      }),
    ).toBe(true);
    expect(
      canCreateTimeBlock({
        isLoading: false,
        isError: false,
        professionalsCount: 2,
        professionalId: "professional-1",
      }),
    ).toBe(true);
  });

  it("allows the default global scope for a valid team with zero or one professional", () => {
    expect(canCreateTimeBlock({ isLoading: false, isError: false, professionalsCount: 0 })).toBe(
      true,
    );
    expect(canCreateTimeBlock({ isLoading: false, isError: false, professionalsCount: 1 })).toBe(
      true,
    );
  });
});
