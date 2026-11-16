import { describe, expect, it } from "vitest";
import { copyPixCode } from "./copy-pix-code";

describe("copyPixCode", () => {
  it("reports success only after clipboard writing resolves", async () => {
    let resolveWrite: (() => void) | undefined;
    const write = copyPixCode(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    let settled = false;
    void write.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);
    resolveWrite?.();
    await expect(write).resolves.toBe(true);
  });

  it("reports clipboard rejection without confirming a copy", async () => {
    await expect(copyPixCode(() => Promise.reject(new Error("clipboard denied")))).resolves.toBe(
      false,
    );
  });
});
