import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installErrorCollector } from "./error-collector";

let listeners: Map<string, Set<(event: unknown) => void>>;
let stop: (() => void) | undefined;
let originalFetch: ReturnType<typeof vi.fn>;
class FakeImage {}
class FakeErrorEvent {
  constructor(
    public message: string,
    public error = new Error(message),
    public target: unknown = null,
  ) {}
}
function emit(type: string, event: unknown) {
  for (const fn of listeners.get(type) ?? []) fn(event);
}
beforeEach(() => {
  vi.useFakeTimers();
  listeners = new Map();
  originalFetch = vi.fn().mockResolvedValue(new Response("error", { status: 500 }));
  vi.stubGlobal("HTMLImageElement", FakeImage);
  vi.stubGlobal("ErrorEvent", FakeErrorEvent);
  vi.stubGlobal("window", {
    location: { href: "https://app.test/painel?private=yes" },
    fetch: originalFetch,
    setInterval,
    clearInterval,
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: (event: unknown) => void) =>
      listeners.get(type)?.delete(fn),
  });
});
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("production error collector", () => {
  it("captures failed fetches without changing their response and deduplicates events", async () => {
    const report = vi.fn().mockResolvedValue(undefined);
    stop = installErrorCollector(report);
    const first = await window.fetch("https://api.test/data?token=secret");
    await window.fetch("https://api.test/data?token=secret");
    expect(first.status).toBe(500);
    await vi.advanceTimersByTimeAsync(1000);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0]?.[0]).toMatchObject({
      kind: "request_failed",
      source: "https://app.test/painel",
      detail: { url: "https://api.test/data", status: 500 },
    });
    expect(JSON.stringify(report.mock.calls)).not.toContain("secret");
  });
  it("captures UI errors and unhandled rejections and removes listeners on cleanup", async () => {
    const report = vi.fn().mockResolvedValue(undefined);
    stop = installErrorCollector(report);
    emit("error", new FakeErrorEvent("UI failed"));
    emit("unhandledrejection", { reason: new Error("Rejected") });
    await vi.advanceTimersByTimeAsync(2000);
    expect(report.mock.calls.map((call) => call[0].kind)).toEqual([
      "ui_error",
      "unhandled_rejection",
    ]);
    stop();
    stop = undefined;
    expect(window.fetch).toBe(originalFetch);
    emit("error", new FakeErrorEvent("Later"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(report).toHaveBeenCalledTimes(2);
  });
  it("never recursively records failures of its own reporting transport", async () => {
    const report = vi.fn(async () => {
      await window.fetch("https://app.test/report");
      throw new Error("Logging is offline");
    });
    stop = installErrorCollector(report);
    emit("error", new FakeErrorEvent("Original failure"));
    await vi.advanceTimersByTimeAsync(6000);
    expect(report).toHaveBeenCalledTimes(1);
  });
  it("keeps intentional aborts out of monitoring while preserving the rejection", async () => {
    originalFetch.mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    const report = vi.fn().mockResolvedValue(undefined);
    stop = installErrorCollector(report);
    await expect(window.fetch("https://api.test/data")).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(report).not.toHaveBeenCalled();
  });
  it("bounds reporting to ten events per minute", async () => {
    const report = vi.fn().mockResolvedValue(undefined);
    stop = installErrorCollector(report);
    for (let i = 0; i < 40; i++) emit("error", new FakeErrorEvent(`Failure ${i}`));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(report).toHaveBeenCalledTimes(10);
  });
  it("keeps distinct broken images as separate diagnostic evidence", async () => {
    const report = vi.fn().mockResolvedValue(undefined);
    stop = installErrorCollector(report);
    for (const name of ["first", "second"]) {
      const image = Object.assign(new FakeImage(), {
        currentSrc: `https://storage.test/${name}.png?token=secret`,
      });
      emit("error", new FakeErrorEvent("image failed", new Error(), image));
    }
    await vi.advanceTimersByTimeAsync(2000);
    expect(report).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(report.mock.calls)).not.toContain("secret");
  });
});
