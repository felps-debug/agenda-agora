import assert from "node:assert/strict";
import { createRequire } from "node:module";

const rootRequire = createRequire(import.meta.url);
const parserEntry = rootRequire.resolve("@typescript-eslint/typescript-estree");
const parserRequire = createRequire(parserEntry);
const minimatchPackage = parserRequire("minimatch/package.json");
const [major, minor, patch] = minimatchPackage.version.split(".").map(Number);

assert.ok(
  major > 11 || (major === 11 && (minor > 0 || (minor === 0 && patch >= 1))),
  `typescript-estree resolves vulnerable minimatch ${minimatchPackage.version}; expected >=11.0.1`,
);

const { minimatch } = parserRequire("minimatch");
assert.equal(typeof minimatch, "function", "the named minimatch API must remain callable");
assert.equal(minimatch("src/lib/example.test.ts", "**/*.test.ts", { dot: true }), true);
assert.equal(minimatch("src/lib/example.ts", "**/*.test.ts", { dot: true }), false);

process.stdout.write(
  `typescript-estree minimatch ${minimatchPackage.version}: compatibility passed\n`,
);
