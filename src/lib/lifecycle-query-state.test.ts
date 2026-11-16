import { describe, expect, it } from "vitest";
import { lifecycleQueryState } from "./lifecycle-query-state";

describe("lifecycleQueryState", () => {
  it("shows loading before the first successful response", () => {
    expect(lifecycleQueryState({ isLoading: true, isError: false, hasData: false })).toBe(
      "loading",
    );
  });

  it("keeps an error distinct from an empty result", () => {
    expect(lifecycleQueryState({ isLoading: false, isError: true, hasData: false })).toBe("error");
  });

  it("accepts a valid empty response", () => {
    expect(lifecycleQueryState({ isLoading: false, isError: false, hasData: true })).toBe("ready");
  });
});
