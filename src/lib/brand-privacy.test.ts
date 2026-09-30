import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    return /\.[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

function visibleStrings(source: string): string[] {
  return [...source.matchAll(/(?:"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`)/g)].map(
    (match) => match[1] ?? match[2] ?? match[3] ?? "",
  );
}

describe("privacidade da marca de pagamentos", () => {
  it("não expõe o nome do processador em textos visíveis", () => {
    const routeFiles = filesUnder(join(process.cwd(), "src/routes")).filter(
      (path) => !path.endsWith("painel.master.tsx") && !path.includes(join("src", "routes", "api")),
    );
    const files = [
      ...routeFiles,
      join(process.cwd(), "src/lib/booking.functions.ts"),
      join(process.cwd(), "src/lib/whatsapp-notify.server.ts"),
    ];

    const exposed = files.flatMap((path) =>
      visibleStrings(
        readFileSync(path, "utf8")
          .replace(/(?:import|export)\s[\s\S]*?from\s+["'][^"']+["'];?/g, "")
          .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ""),
      )
        .filter(
          (value) =>
            /agpay|asaas/i.test(value) &&
            !/^(?:\.\/)?agpay(?:-events)?\.server$|^agpay$/i.test(value),
        )
        .map((value) => `${path}: ${value}`),
    );

    expect(exposed).toEqual([]);
  });
});
