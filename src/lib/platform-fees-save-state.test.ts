import { describe, expect, it } from "vitest";
import { isPlatformFeesSaveDisabled } from "./platform-fees-save-state";

describe("isPlatformFeesSaveDisabled", () => {
  it("blocks writes while the initial read is loading or failed", () => {
    expect(isPlatformFeesSaveDisabled({ isPending: false, isLoading: true, isError: false })).toBe(
      true,
    );
    expect(isPlatformFeesSaveDisabled({ isPending: false, isLoading: false, isError: true })).toBe(
      true,
    );
  });

  it("allows writes only after a successful read and while idle", () => {
    expect(isPlatformFeesSaveDisabled({ isPending: false, isLoading: false, isError: false })).toBe(
      false,
    );
    expect(isPlatformFeesSaveDisabled({ isPending: true, isLoading: false, isError: false })).toBe(
      true,
    );
  });
});
