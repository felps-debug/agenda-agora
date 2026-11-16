import { describe, expect, it } from "vitest";
import { pixApprovalListState } from "./pix-approval-list-state";

describe("pixApprovalListState", () => {
  it("shows loading before the first response", () => {
    expect(
      pixApprovalListState({ isLoading: true, isError: false, hasData: false, hasPending: false }),
    ).toBe("loading");
  });

  it("keeps a distinct error state even when the query has no data", () => {
    expect(
      pixApprovalListState({ isLoading: false, isError: true, hasData: false, hasPending: false }),
    ).toBe("error");
  });

  it("shows an empty queue only after a valid empty response", () => {
    expect(
      pixApprovalListState({ isLoading: false, isError: false, hasData: true, hasPending: false }),
    ).toBe("empty");
  });

  it("renders a pending queue after a valid response", () => {
    expect(
      pixApprovalListState({ isLoading: false, isError: false, hasData: true, hasPending: true }),
    ).toBe("ready");
  });
});
