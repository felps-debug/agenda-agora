import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".sql",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const mojibakeMarkers = [
  ...Array.from({ length: 0x60 }, (_, index) => String.fromCharCode(0x00c3, 0x00a0 + index)),
  String.fromCharCode(0x00c3, 0x0192),
  String.fromCharCode(0x00c2),
  String.fromCharCode(0xfffd),
  String.fromCharCode(0x00ef, 0x00bf, 0x00bd),
];

function textFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const filePath = join(directory, name);
    const stat = statSync(filePath);
    if (stat.isDirectory()) return textFiles(filePath);
    return textExtensions.has(extname(name).toLowerCase()) ? [filePath] : [];
  });
}

describe("codificação dos textos do produto", () => {
  it("não deixa sequências de mojibake em src ou docs", () => {
    const directories = [join(projectRoot, "src"), join(projectRoot, "docs")];
    const files = directories.flatMap(textFiles);
    const affectedFiles = files
      .filter((filePath) => {
        const contents = readFileSync(filePath, "utf8");
        return mojibakeMarkers.some((marker) => contents.includes(marker));
      })
      .map((filePath) => relative(projectRoot, filePath));

    expect(affectedFiles).toEqual([]);
  });
});
