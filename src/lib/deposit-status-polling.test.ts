import { describe, expect, it } from "vitest";
import { getDepositStatusPollDelay } from "./deposit-status-polling";

describe("backoff do polling de status Pix", () => {
  it("reduz a frequência normal e aumenta o intervalo após falhas", () => {
    expect(getDepositStatusPollDelay(0)).toBe(15_000);
    expect(getDepositStatusPollDelay(1)).toBe(30_000);
    expect(getDepositStatusPollDelay(2)).toBe(60_000);
    expect(getDepositStatusPollDelay(10)).toBe(60_000);
  });
});
