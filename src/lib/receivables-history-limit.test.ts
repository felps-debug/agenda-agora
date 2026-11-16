import { describe, expect, it } from "vitest";
import { RECEIVABLES_HISTORY_LIMIT_DAYS } from "./receivables-history-limit";

describe("receivables history limit", () => {
  it("keeps the visible historical range aligned with the server filter", () => {
    expect(RECEIVABLES_HISTORY_LIMIT_DAYS).toBe(120);
  });
});
