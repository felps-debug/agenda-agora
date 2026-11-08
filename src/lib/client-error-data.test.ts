import { describe, expect, it } from "vitest";
import { safeErrorDetail, safeErrorSource, safeErrorText } from "./client-error-data";

describe("client error privacy", () => {
  it("removes signed URL tokens, query and fragment", () => {
    expect(safeErrorSource("https://storage.test/file?token=secret#private")).toBe(
      "https://storage.test/file",
    );
    expect(safeErrorText("fetch https://storage.test/file?token=secret")).not.toContain("secret");
  });
  it("redacts credentials and PII and truncates long text", () => {
    const value = safeErrorText("Bearer super-secret password=abc12345 a@b.test 11999999999");
    expect(value).not.toMatch(/super-secret|abc12345|a@b.test|11999999999/);
    expect(safeErrorText("a".repeat(3000)).length).toBe(2000);
  });
  it("drops bodies, headers, user objects and arbitrary secrets", () => {
    expect(
      safeErrorDetail({
        body: "private",
        headers: { authorization: "secret" },
        password: "private",
        status: 500,
        url: "/api?key=secret",
      }),
    ).toEqual({ status: 500, url: "/api" });
  });
  it("redacts credentials embedded in JSON error text", () => {
    expect(safeErrorText('{"password":"super-secret"}')).not.toContain("super-secret");
    expect(safeErrorText('{"password":"a secret with spaces"}')).not.toContain("with spaces");
    expect(safeErrorText("Authorization: Basic abcde1234")).not.toContain("abcde1234");
    expect(safeErrorText("Contato (11) 99999-9999")).not.toContain("99999");
  });
});
