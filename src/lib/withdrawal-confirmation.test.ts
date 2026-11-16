import { describe, expect, it, vi } from "vitest";
import { startWithdrawalConfirmation } from "./withdrawal-confirmation";

describe("startWithdrawalConfirmation", () => {
  it("starts no more than one PIN verification while a submission is pending", () => {
    const lock = { current: false };
    const verifyPin = vi.fn();

    expect(startWithdrawalConfirmation(lock, verifyPin)).toBe(true);
    expect(startWithdrawalConfirmation(lock, verifyPin)).toBe(false);
    expect(verifyPin).toHaveBeenCalledTimes(1);
  });

  it("allows a new user submission after the previous one releases its lock", () => {
    const lock = { current: false };
    const verifyPin = vi.fn();

    startWithdrawalConfirmation(lock, verifyPin);
    lock.current = false;
    expect(startWithdrawalConfirmation(lock, verifyPin)).toBe(true);
    expect(verifyPin).toHaveBeenCalledTimes(2);
  });
});
