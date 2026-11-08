import { describe, expect, it } from "vitest";
import { isStrongOwnerPassword } from "./password-strength";
import { resolveLoginCredentials } from "./auth/login-flow";

describe("owner password policy and login compatibility", () => {
  it.each(["", "1234", "abc1234", "abcdefgh", "12345678", "a".repeat(129) + "1"])(
    "rejects weak password %s",
    (password) => {
      expect(isStrongOwnerPassword(password)).toBe(false);
    },
  );
  it.each(["abc12345", "Longa senha 1!"])(
    "accepts strong passwords and submits them unchanged to Auth",
    (password) => {
      expect(isStrongOwnerPassword(password)).toBe(true);
      expect(resolveLoginCredentials("11900000000", password).password).toBe(password);
    },
  );
  it("retains existing PIN credentials", () => {
    expect(resolveLoginCredentials("11900000000", "1234").password).toBe("agendaagora:1234");
  });
});
