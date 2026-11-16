import { describe, expect, it } from "vitest";
import { canEditBusinessCoupon } from "./coupon-edit-state";

describe("canEditBusinessCoupon", () => {
  it.each([
    [{ isLoading: true, isError: false, hasData: false }, false],
    [{ isLoading: false, isError: true, hasData: false }, false],
    [{ isLoading: false, isError: false, hasData: false }, false],
    [{ isLoading: false, isError: false, hasData: true }, true],
  ] as const)("allows editing only after a successful read: %j", (state, expected) => {
    expect(canEditBusinessCoupon(state)).toBe(expected);
  });
});
