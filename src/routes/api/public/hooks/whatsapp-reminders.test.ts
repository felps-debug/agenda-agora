import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdmin } from "@/test-support/fake-admin";

const runtime = vi.hoisted(() => ({
  fake: null as null | ReturnType<typeof import("@/test-support/fake-admin").createFakeAdmin>,
  sendBookingReminder: vi.fn(),
  sendExtraBookingReminder: vi.fn(),
  processIncomingGreetings: vi.fn(async (..._args: unknown[]) => ({
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  })),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@/integrations/supabase/cron-auth", () => ({
  authenticateCronRequest: async () => null,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => runtime.fake!.client.from(table),
    rpc: (name: string, args: Record<string, unknown>) => runtime.fake!.client.rpc(name, args),
  },
}));
vi.mock("@/lib/panel1-config.storage", () => ({
  loadPanel1Config: async () => ({
    preferences: { extra_reminder_minutes: 0, extra_reminder_template: "" },
  }),
}));
vi.mock("@/lib/whatsapp-notify.server", () => ({
  isReminderDue: (startsAt: string, now: Date, leadMinutes: number) => {
    const remaining = Date.parse(startsAt) - now.getTime();
    return remaining > 0 && remaining <= leadMinutes * 60_000;
  },
  sendBookingReminder: (...args: unknown[]) => runtime.sendBookingReminder(...args),
  sendExtraBookingReminder: (...args: unknown[]) => runtime.sendExtraBookingReminder(...args),
}));
vi.mock("@/lib/whatsapp-greeting.server", () => ({
  processPostServiceMessages: async () => ({ processed: 0, failed: 0 }),
  processPendingIncomingWhatsappGreetings: (...args: unknown[]) =>
    runtime.processIncomingGreetings(...args),
}));

const { Route } = await import("./whatsapp-reminders");
const post = (
  Route as unknown as {
    options: { server: { handlers: { POST: (arg: { request: Request }) => Promise<Response> } } };
  }
).options.server.handlers.POST;

function request() {
  return new Request("https://app.test/api/public/hooks/whatsapp-reminders", { method: "POST" });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-14T18:00:00.000Z"));
  runtime.fake = createFakeAdmin({
    businesses: [
      { id: "business-1", reminder_enabled: true, reminder_hours_before: 60, status: "ativo" },
    ],
    appointments: [
      {
        id: "appointment-1",
        business_id: "business-1",
        starts_at: "2026-11-14T18:30:00.000Z",
        status: "agendado",
      },
    ],
    reminder_logs: [],
  });
  runtime.fake.rpcHandlers["claim_whatsapp_reminder"] = (args) => {
    const logs = runtime.fake!.tables["reminder_logs"]!;
    const log = logs.find(
      (row) =>
        row["appointment_id"] === args["p_appointment_id"] && row["channel"] === args["p_channel"],
    );
    if (log && log["status"] !== "erro") return null;
    const token = `claim-${logs.length + 1}`;
    if (log) Object.assign(log, { status: "processing", error: null, claim_token: token });
    else {
      logs.push({
        id: `log-${logs.length + 1}`,
        business_id: args["p_business_id"],
        appointment_id: args["p_appointment_id"],
        channel: args["p_channel"],
        status: "processing",
        error: null,
        claim_token: token,
      });
    }
    return token;
  };
  runtime.fake.rpcHandlers["finish_whatsapp_reminder"] = (args) => {
    const log = runtime.fake!.tables["reminder_logs"]!.find(
      (row) =>
        row["appointment_id"] === args["p_appointment_id"] &&
        row["channel"] === args["p_channel"] &&
        row["claim_token"] === args["p_claim_token"],
    );
    if (!log) return false;
    Object.assign(log, {
      status: args["p_sent"] ? "enviado" : "erro",
      error: args["p_error"],
      claim_token: null,
    });
    return true;
  };
  runtime.sendBookingReminder.mockReset();
  runtime.sendExtraBookingReminder.mockReset();
  runtime.processIncomingGreetings.mockReset();
  runtime.processIncomingGreetings.mockResolvedValue({
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  });
  runtime.sendBookingReminder.mockRejectedValueOnce(new Error("Evolution offline"));
});

describe("cron de lembretes WhatsApp", () => {
  it("retorna erro quando não consegue ler os agendamentos e não envia mensagens", async () => {
    runtime.fake!.failures["appointments:select"] = { message: "consulta indisponível" };
    const response = await post({ request: request() });
    expect(response.status).toBe(500);
    expect(runtime.sendBookingReminder).not.toHaveBeenCalled();
  });

  it("tenta novamente após erro e não reenvia lembrete já concluído", async () => {
    const first = await post({ request: request() });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ failed: 1, sent: 0 });
    expect(runtime.processIncomingGreetings).toHaveBeenCalledWith({ limit: 50 });
    expect(runtime.fake!.tables["reminder_logs"]![0]).toMatchObject({ status: "erro" });

    const second = await post({ request: request() });
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ failed: 0, sent: 1 });
    expect(runtime.fake!.tables["reminder_logs"]).toHaveLength(1);
    expect(runtime.fake!.tables["reminder_logs"]![0]).toMatchObject({
      status: "enviado",
      error: null,
      claim_token: null,
    });

    const third = await post({ request: request() });
    expect(third.status).toBe(200);
    expect(await third.json()).toMatchObject({ sent: 0, failed: 0 });
    expect(runtime.sendBookingReminder).toHaveBeenCalledTimes(2);
    expect(runtime.sendExtraBookingReminder).not.toHaveBeenCalled();
  });
});
