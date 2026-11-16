import { describe, expect, it } from "vitest";
import { migrationFiles } from "../../scripts/ensaio/db.mjs";

describe("baseline do banco de ensaio", () => {
  it("reaplica somente as migrations posteriores ao snapshot de produção", () => {
    const files = migrationFiles();
    const versions = files.map((file) => file.name.slice(0, 14));

    expect(versions).toHaveLength(22);
    expect(versions[0]).toBe("20261114120000");
    expect(versions.at(-1)).toBe("20261116060100");
    expect(versions.every((version) => version > "20261108122836")).toBe(true);
  });
});
