import { describe, expect, it } from "vitest";
import { receivablesViewState } from "./receivables-view-state";

describe("receivablesViewState", () => {
  it("does not show KPIs before the first response", () => {
    expect(receivablesViewState({ isLoading: true, isError: false, hasData: false })).toBe(
      "loading",
    );
  });

  it("shows an error instead of stale or zero-valued KPIs after a failed query", () => {
    expect(receivablesViewState({ isLoading: false, isError: true, hasData: true })).toBe("error");
  });

  it("allows zero values after a successful empty response", () => {
    expect(receivablesViewState({ isLoading: false, isError: false, hasData: true })).toBe("ready");
  });
});
