import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  request: null as Request | null,
  inserts: [] as unknown[],
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (data: unknown) => data;
    const builder = {
      middleware: () => builder,
      inputValidator: (validator: (data: unknown) => unknown) => {
        validate = validator;
        return builder;
      },
      handler:
        (handler: (args: { data: unknown; context: unknown }) => unknown) =>
        (args: { data?: unknown; context?: unknown } = {}) =>
          handler({ data: validate(args.data), context: args.context }),
    };
    return builder;
  },
}));

vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => runtime.request }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/auth/require-super-admin", () => ({ assertSuperAdmin: vi.fn() }));
vi.mock("@/lib/env-security.server", () => ({
  getAllowedAppOrigins: () => new Set(["https://agenda.test"]),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
    from: (table: string) => ({
      insert: async (row: unknown) => {
        if (table === "client_error_log") runtime.inserts.push(row);
        return { error: null };
      },
    }),
  },
}));

const { logClientError } = await import("./error-log.functions");
const invokeLogClientError = logClientError as unknown as (args: {
  data: { kind: "ui_error"; message: string; source: string };
}) => Promise<{ ok: true }>;

describe("logClientError rate limit", () => {
  beforeEach(() => {
    runtime.inserts.length = 0;
  });

  it("não deixa X-Forwarded-For forjado criar chaves diferentes para a mesma conexão", async () => {
    for (let attempt = 0; attempt < 12; attempt++) {
      runtime.request = new Request("https://agenda.test/api", {
        method: "POST",
        headers: {
          origin: "https://agenda.test",
          "x-forwarded-for": `192.0.2.${attempt + 1}, 198.51.100.77`,
        },
      });
      await invokeLogClientError({
        data: { kind: "ui_error", message: "test error", source: "https://agenda.test/painel" },
      });
    }

    expect(runtime.inserts).toHaveLength(10);
  });
});
