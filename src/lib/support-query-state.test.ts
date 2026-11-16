import { describe, expect, it } from "vitest";
import { supportQueryState } from "./support-query-state";

describe("supportQueryState", () => {
  it("distinguishes loading, query failure, valid empty, and valid populated results", () => {
    expect(supportQueryState({ isPending: true, isError: false, hasData: false })).toBe("loading");
    expect(supportQueryState({ isPending: false, isError: true, hasData: false })).toBe("error");
    expect(supportQueryState({ isPending: false, isError: false, hasData: true })).toBe("ready");
  });

  it("does not replace a query error with stale cached data", () => {
    expect(supportQueryState({ isPending: false, isError: true, hasData: true })).toBe("error");
  });
});
