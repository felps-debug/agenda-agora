import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdmin } from "@/test-support/fake-admin";

const DAY = 86_400_000;
const SECRET = "segredo-do-cron-de-teste";

const runtime = vi.hoisted(() => ({
  fake: null as null | ReturnType<typeof import("@/test-support/fake-admin").createFakeAdmin>,
  autoCancel: false,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@/lib/platform-settings.server", () => ({
  getSetting: async (key: string, fallback: unknown) =>
    key === "lifecycle_auto_cancel_enabled" ? runtime.autoCancel : fallback,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => runtime.fake!.client.from(table),
    rpc: (name: string, args: Record<string, unknown>) => runtime.fake!.client.rpc(name, args),
  },
}));

await import("@/integrations/supabase/client.server");
const { Route } = await import("./subscription-lifecycle");
const post = (
  Route as unknown as {
    options: { server: { handlers: { POST: (arg: { request: Request }) => Promise<Response> } } };
  }
).options.server.handlers.POST;

function request(authorization?: string) {
  return new Request("https://app.test/api/public/hooks/subscription-lifecycle", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

// A classificação conta dias de calendário no fuso local (startOfDay). Sem congelar o relógio,
// "agora - 4,2 dias" cai no dia 5 quando o teste roda entre 00:00 e ~04:48 e a suíte passa a
// depender da hora em que é executada. Meio-dia local mantém todos os cenários no dia esperado.
afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const noon = new Date();
  noon.setHours(12, 0, 0, 0);
  vi.setSystemTime(noon);
  process.env["AGENDA_CRON_SECRET"] = SECRET;
  delete process.env["AGENDA_CRON_SECRET_PREVIOUS"];
  runtime.autoCancel = false;
  runtime.fake = createFakeAdmin({
    businesses: [
      // assinante 16 dias vencido: candidato ao cancelamento do dia 15
      {
        id: "inadimplente",
        status: "ativo",
        trial_days: null,
        access_until: iso(-16),
        cancel_requested_at: null,
        cancelled_at: null,
      },
      // assinante vencido há 4 dias: aviso "Assinatura vencida (dia 4)"
      {
        id: "dia4",
        status: "ativo",
        trial_days: null,
        access_until: iso(-4.2),
        cancel_requested_at: null,
        cancelled_at: null,
      },
      // assinante em dia
      {
        id: "em-dia",
        status: "ativo",
        trial_days: null,
        access_until: iso(20),
        cancel_requested_at: null,
        cancelled_at: null,
      },
    ],
    master_business_events: [],
    auth_attempts: [
      { key: "velha", updated_at: iso(-10) },
      { key: "recente", updated_at: iso(-1) },
    ],
  });
  runtime.fake.rpcHandlers["cancel_overdue_business"] = (args) => {
    const row = runtime.fake!.tables["businesses"]!.find((b) => b["id"] === args["p_business_id"]);
    if (!row || row["cancelled_at"]) return false;
    row["cancelled_at"] = new Date().toISOString();
    return true;
  };
});

describe("rota do ciclo de assinatura (US6)", () => {
  it("sem Authorization responde 401 e não toca no banco", async () => {
    const response = await post({ request: request() });
    expect(response.status).toBe(401);
    expect(runtime.fake!.calls.inserts).toHaveLength(0);
  });

  it("bearer errado responde 401", async () => {
    const response = await post({ request: request("Bearer outro-segredo") });
    expect(response.status).toBe(401);
  });

  it("com a chave desligada (padrão) avisa mas nunca cancela", async () => {
    const response = await post({ request: request(`Bearer ${SECRET}`) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.cancellationsCreated).toBe(0);
    expect(
      runtime.fake!.tables["businesses"]!.find((b) => b["id"] === "inadimplente")!["cancelled_at"],
    ).toBeNull();
  });

  it("com a chave ligada cancela o inadimplente de 15+ dias, só ele", async () => {
    runtime.autoCancel = true;
    const response = await post({ request: request(`Bearer ${SECRET}`) });
    const body = await response.json();
    expect(body.cancellationsCreated).toBe(1);
    const businesses = runtime.fake!.tables["businesses"]!;
    expect(businesses.find((b) => b["id"] === "inadimplente")!["cancelled_at"]).toBeTruthy();
    expect(businesses.find((b) => b["id"] === "em-dia")!["cancelled_at"]).toBeNull();
    expect(businesses.find((b) => b["id"] === "dia4")!["cancelled_at"]).toBeNull();
  });

  it("duas execuções seguidas: a segunda não repete avisos nem cancelamentos", async () => {
    runtime.autoCancel = true;
    const first = await (await post({ request: request(`Bearer ${SECRET}`) })).json();
    const eventsAfterFirst = runtime.fake!.tables["master_business_events"]!.length;
    const second = await (await post({ request: request(`Bearer ${SECRET}`) })).json();
    expect(first.created).toBeGreaterThan(0);
    expect(first.cancellationsCreated).toBe(1);
    expect(second.created).toBe(0);
    expect(second.cancellationsCreated).toBe(0);
    expect(runtime.fake!.tables["master_business_events"]!.length).toBe(eventsAfterFirst);
  });

  it("limpa tentativas de login com mais de 7 dias e registra a execução", async () => {
    const body = await (await post({ request: request(`Bearer ${SECRET}`) })).json();
    expect(body.cleanedAttempts).toBe(1);
    expect(runtime.fake!.tables["auth_attempts"]!.map((r) => r["key"])).toEqual(["recente"]);
    const run = runtime.fake!.calls.inserts.find((i) => i.table === "subscription_lifecycle_runs");
    expect(run?.row).toMatchObject({ businesses_scanned: 3, cancellations_created: 0 });
  });
});
