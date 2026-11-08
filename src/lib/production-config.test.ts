import { describe, expect, it } from "vitest";
import { validateProductionConfig } from "./production-config";
const good = {
  PUBLIC_APP_URL: "https://app.example/painel",
  ALLOWED_APP_ORIGINS: "http://localhost:3002,https://app.example",
  MASTER_RETURN_PIN: "12345678",
  MASTER_SECURITY_PIN: "87654321",
};
describe("production config", () => {
  it("accepts a configured public origin and both env-only PINs", () =>
    expect(validateProductionConfig(good)).toEqual({ ok: true, problems: [] }));
  it.each([
    "PUBLIC_APP_URL",
    "ALLOWED_APP_ORIGINS",
    "MASTER_RETURN_PIN",
    "MASTER_SECURITY_PIN",
  ] as const)("refuses missing %s", (key) =>
    expect(validateProductionConfig({ ...good, [key]: undefined }).ok).toBe(false),
  );
  it("refuses mismatched origins, invalid URLs and invalid PINs", () => {
    for (const bad of [
      { ALLOWED_APP_ORIGINS: "https://other.example" },
      { PUBLIC_APP_URL: "not a url" },
      { ALLOWED_APP_ORIGINS: "https://app.example,invalid" },
      { MASTER_RETURN_PIN: "abcd" },
      { PUBLIC_APP_URL: "file:///tmp" },
    ])
      expect(validateProductionConfig({ ...good, ...bad }).ok).toBe(false);
  });
});
