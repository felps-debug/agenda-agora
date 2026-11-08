import {
  safeErrorText,
  safeErrorSource,
  safeErrorDetail,
  type ClientErrorKind,
} from "./client-error-data";

export type CapturedClientError = {
  kind: ClientErrorKind;
  message: string;
  source: string;
  detail?: Record<string, unknown>;
};
type SanitizedClientError = Omit<CapturedClientError, "detail"> & {
  detail: Record<string, string | number>;
};
let activeReporter: ((error: CapturedClientError) => void) | undefined;
const pending: CapturedClientError[] = [];
export function reportCapturedError(error: unknown) {
  if (typeof window === "undefined") return;
  const event: CapturedClientError = {
    kind: "ui_error",
    message: error instanceof Error ? error.message : String(error),
    source: window.location.href,
    detail: { stack: error instanceof Error ? error.stack : undefined },
  };
  if (activeReporter) activeReporter(event);
  else if (pending.length < 20) pending.push(event);
}

export function installErrorCollector(report: (error: SanitizedClientError) => Promise<unknown>) {
  const originalFetch = window.fetch;
  const queue: SanitizedClientError[] = [];
  const seen = new Map<string, number>();
  let reporting = false;
  let disposed = false;
  let sentAt: number[] = [];
  const enqueue = (error: CapturedClientError) => {
    if (disposed || reporting) return;
    const safe = {
      ...error,
      message: safeErrorText(error.message),
      source: safeErrorSource(error.source),
      detail: safeErrorDetail(error.detail),
    };
    const key = `${safe.kind}:${safe.source}:${safe.message}:${safe.detail["url"] ?? safe.detail["image"] ?? ""}`;
    const now = Date.now();
    for (const [entry, at] of seen) if (now - at > 60_000) seen.delete(entry);
    if (seen.has(key) || queue.length >= 20) return;
    seen.set(key, now);
    queue.push(safe);
  };
  activeReporter = enqueue;
  for (const error of pending.splice(0)) enqueue(error);
  const flush = async () => {
    if (disposed || reporting || !queue.length) return;
    sentAt = sentAt.filter((at) => Date.now() - at < 60_000);
    if (sentAt.length >= 10) return;
    reporting = true;
    sentAt.push(Date.now());
    try {
      await report(queue.shift()!);
    } catch {
      /* Best effort, no recursion or UI failure. */
    } finally {
      reporting = false;
    }
  };
  const timer = window.setInterval(() => {
    void flush();
  }, 1000);
  const onError = (event: Event) => {
    if (event.target instanceof HTMLImageElement) {
      enqueue({
        kind: "request_failed",
        message: "Image failed to load",
        source: window.location.href,
        detail: { image: event.target.currentSrc || event.target.src },
      });
    } else if (event instanceof ErrorEvent) {
      enqueue({
        kind: "ui_error",
        message: event.message,
        source: window.location.href,
        detail: { stack: event.error?.stack },
      });
    }
  };
  const onRejection = (event: PromiseRejectionEvent) =>
    enqueue({
      kind: "unhandled_rejection",
      message: event.reason instanceof Error ? event.reason.message : String(event.reason),
      source: window.location.href,
      detail: { stack: event.reason instanceof Error ? event.reason.stack : undefined },
    });
  const patchedFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    // Exclude the reporting transport; otherwise a failed log can log itself forever.
    const monitor = !reporting;
    try {
      const response = await originalFetch.call(window, input, init);
      if (monitor && response.status >= 400)
        enqueue({
          kind: "request_failed",
          message: `HTTP ${response.status}`,
          source: window.location.href,
          detail: { url, status: response.status, method: init?.method ?? "GET" },
        });
      return response;
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      if (monitor && !aborted)
        enqueue({
          kind: "request_failed",
          message: error instanceof Error ? error.message : "Network request failed",
          source: window.location.href,
          detail: { url },
        });
      throw error;
    }
  };
  window.fetch = patchedFetch;
  window.addEventListener("error", onError, true);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    disposed = true;
    window.clearInterval(timer);
    window.removeEventListener("error", onError, true);
    window.removeEventListener("unhandledrejection", onRejection);
    if (window.fetch === patchedFetch) window.fetch = originalFetch;
    if (activeReporter === enqueue) activeReporter = undefined;
  };
}
