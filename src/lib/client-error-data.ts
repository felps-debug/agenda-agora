export type ClientErrorKind = "ui_error" | "unhandled_rejection" | "request_failed";
export type ClientErrorRow = {
  id: string;
  occurred_at: string;
  kind: ClientErrorKind;
  message: string;
  source: string;
  detail: Record<string, unknown>;
  business_id: string | null;
  user_id: string | null;
  app_version: string | null;
};
export type ClientErrorDatabase = {
  public: {
    Tables: {
      client_error_log: {
        Row: ClientErrorRow;
        Insert: Omit<ClientErrorRow, "id" | "occurred_at" | "app_version" | "business_id"> & {
          business_id?: string | null;
          app_version?: string | null;
        };
        Update: Partial<ClientErrorRow>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export function safeErrorSource(source: string): string {
  try {
    const url = new URL(source, "https://local.invalid");
    return `${url.origin === "https://local.invalid" ? "" : url.origin}${url.pathname}`.slice(
      0,
      500,
    );
  } catch {
    return "unknown";
  }
}

export function safeErrorText(text: string, limit = 2000): string {
  return text
    .replace(/https?:\/\/[^\s"'<>]+/gi, (url) => safeErrorSource(url))
    .replace(
      /(?:Bearer|Basic)\s+\S+|sb_(?:secret|publishable)_\S+|eyJ[\w-]+\.[\w-]+\.[\w-]+/gi,
      "[token]",
    )
    .replace(
      /((?:password|senha|pin|secret|token|authorization|api[_-]?key)["']?\s*[=:]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/gi,
      '$1"[redacted]"',
    )
    .replace(
      /((?:password|senha|pin|secret|token|authorization|api[_-]?key)["']?\s*[=:]\s*["']?)[^\s,"';}]+/gi,
      "$1[redacted]",
    )
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email]")
    .replace(/(?:\+?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}\b/g, "[phone]")
    .replace(/\b\d{8,}\b/g, "[number]")
    .slice(0, limit);
}

/** Allowlist: never store request headers, bodies, cookies or arbitrary objects. */
export function safeErrorDetail(
  detail: Record<string, unknown> = {},
): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (key === "status" && typeof value === "number") result[key] = value;
    if (["stack", "method", "url", "image"].includes(key) && typeof value === "string") {
      result[key] =
        key === "url" || key === "image"
          ? safeErrorSource(value)
          : safeErrorText(value, key === "method" ? 20 : 3000);
    }
  }
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 14000) {
    return { stack: safeErrorText(String(result["stack"] ?? ""), 2000) };
  }
  return result;
}
