import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const caddyfile = readFileSync("ops/vps/Caddyfile", "utf8");
const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
  headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
};

describe("security response headers", () => {
  it("blocks framing at the Caddy and Vercel edges", () => {
    expect(caddyfile).toMatch(/X-Frame-Options\s+"DENY"/i);
    expect(caddyfile).toMatch(/Content-Security-Policy\s+"frame-ancestors 'none'"/i);

    const rules = vercel.headers ?? [];
    const globalHeaders = rules.find((rule) => rule.source === "/(.*)")?.headers ?? [];
    expect(globalHeaders).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
    expect(globalHeaders).toContainEqual({
      key: "Content-Security-Policy",
      value: "frame-ancestors 'none'",
    });
  });
});
