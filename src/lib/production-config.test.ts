import { describe, expect, it } from "vitest";
import { validateProductionConfig } from "./production-config";
const good = {
  NODE_ENV: "development",
  PUBLIC_APP_URL: "https://app.example/painel",
  ALLOWED_APP_ORIGINS: "http://localhost:3002,https://app.example",
  MASTER_RETURN_PIN: "12345678",
  MASTER_SECURITY_PIN: "87654321",
  SDR_TOKEN_SECRET: "s".repeat(32),
  WHATSAPP_WEBHOOK_SECRET: "w".repeat(32),
  AGENDA_CRON_SECRET: "cron-secret",
};
const productionGood = {
  ...good,
  NODE_ENV: "production",
  ALLOWED_APP_ORIGINS: "https://app.example",
};
describe("production config", () => {
  it("accepts a configured public origin and both env-only PINs", () =>
    expect(validateProductionConfig(good)).toEqual({ ok: true, problems: [] }));
  it("accepts valid production feature secrets without exposing their values", () =>
    expect(validateProductionConfig(productionGood)).toEqual({ ok: true, problems: [] }));
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

  it("requires HTTPS for the public URL and every allowed origin in production", () => {
    expect(
      validateProductionConfig({
        ...productionGood,
        PUBLIC_APP_URL: "http://app.example",
      }).ok,
    ).toBe(false);
    expect(
      validateProductionConfig({
        ...productionGood,
        ALLOWED_APP_ORIGINS: "https://app.example,http://localhost:3002",
      }).ok,
    ).toBe(false);
  });

  it.each(["SDR_TOKEN_SECRET", "WHATSAPP_WEBHOOK_SECRET", "AGENDA_CRON_SECRET"] as const)(
    "requires %s during production boot",
    (key) => {
      expect(validateProductionConfig({ ...productionGood, [key]: undefined }).ok).toBe(false);
    },
  );

  it.each(["SDR_TOKEN_SECRET", "WHATSAPP_WEBHOOK_SECRET"] as const)(
    "rejects malformed %s during production boot",
    (key) => {
      const result = validateProductionConfig({ ...productionGood, [key]: "short" });
      expect(result.ok).toBe(false);
      expect(result.problems.join(" ")).not.toContain("short");
    },
  );

  it("allows HTTP only for local origins in development", () => {
    expect(
      validateProductionConfig({
        ...good,
        ALLOWED_APP_ORIGINS: "http://localhost:3002,https://app.example",
      }).ok,
    ).toBe(true);
    expect(
      validateProductionConfig({
        ...good,
        ALLOWED_APP_ORIGINS: "http://app.example,https://app.example",
      }).ok,
    ).toBe(false);
  });
});
