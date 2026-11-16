import { describe, expect, it, vi } from "vitest";
import { persistBeforeCleanup } from "./persist-before-cleanup";

describe("appearance asset cleanup ordering", () => {
  it("runs cleanup only after every configuration write succeeds", async () => {
    const order: string[] = [];

    await persistBeforeCleanup(
      async () => {
        order.push("persisted");
      },
      async () => {
        order.push("cleaned");
      },
    );

    expect(order).toEqual(["persisted", "cleaned"]);
  });

  it("preserves old assets when persistence fails", async () => {
    const cleanup = vi.fn();

    await expect(
      persistBeforeCleanup(async () => {
        throw new Error("write failed");
      }, cleanup),
    ).rejects.toThrow("write failed");

    expect(cleanup).not.toHaveBeenCalled();
  });
});
