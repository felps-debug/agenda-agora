import { describe, expect, it } from "vitest";
import { attentionEmptyState } from "./attention-empty-state";

describe("attentionEmptyState", () => {
  it("reports a global empty queue only when the unfiltered queue is empty", () => {
    expect(
      attentionEmptyState({
        allCount: 0,
        filteredCount: 0,
        hasActiveFilters: false,
        isReady: true,
      }),
    ).toBe("global-empty");
  });

  it("distinguishes filters with no matches from an empty queue", () => {
    expect(
      attentionEmptyState({ allCount: 4, filteredCount: 0, hasActiveFilters: true, isReady: true }),
    ).toBe("filtered-empty");
  });

  it("renders no empty state when results exist", () => {
    expect(
      attentionEmptyState({ allCount: 4, filteredCount: 2, hasActiveFilters: true, isReady: true }),
    ).toBeNull();
  });

  it("does not call a loading or failed query an empty queue", () => {
    expect(
      attentionEmptyState({
        allCount: 0,
        filteredCount: 0,
        hasActiveFilters: false,
        isReady: false,
      }),
    ).toBeNull();
  });
});
