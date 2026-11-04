import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  sendTextMessage: vi.fn(),
  isConnected: vi.fn(),
  whatsappStatus: "conectado",
  greeting: "Bem-vinda!" as string | null,
  timezone: "America/Fortaleza",
  startsAt: "2026-09-28T15:00:00.000Z",
  confirmationTemplate: null as string | null,
}));
vi.mock("./whatsapp-provider.server", () => ({
  loadWhatsappProvider: async () => ({
    sendTextMessage: runtime.sendTextMessage,
    isConnected: runtime.isConnected,
  }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      update: () => ({ eq: async () => ({ error: null }) }),
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data:
              table === "appointments"
                ? {
                    id: "appt-1",
                    business_id: "biz-1",
                    customer_name: "Ana Lima",
                    customer_phone: "98999990000",
                    starts_at: runtime.startsAt,
                    service_id: "svc-1",
                    professional_id: "prof-1",
                  }
                : table === "businesses"
                  ? {
                      id: "biz-1",
                      name: "Barbearia",
                      timezone: runtime.timezone,
                      greeting: runtime.greeting,
                      whatsapp_instance: "inst-1",
                      whatsapp_instance_token: "token-biz-1",
                      whatsapp_status: runtime.whatsappStatus,
                      confirmation_template: runtime.confirmationTemplate,
                      reminder_template: "Lembrete {data} às {hora}",
                      slug: "barbearia",
                      saudacao_template: null,
                      payment_confirmation_template:
                        "Pagamento confirmado para {nome} em {negocio}, {data} às {hora}.",
                    }
                  : table === "services"
                    ? { name: "Corte", price_cents: 3500 }
                    : table === "professionals"
                      ? { name: "José" }
                      : { name: "Corte" },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

const { isReminderDue, sendBookingConfirmation, sendBookingReminder, sendPaymentConfirmation } =
  await import("./whatsapp-notify.server");

describe("mensagens automáticas de WhatsApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.isConnected.mockResolvedValue(true);
    runtime.whatsappStatus = "conectado";
    runtime.greeting = "Bem-vinda!";
    runtime.timezone = "America/Fortaleza";
    runtime.startsAt = "2026-09-28T15:00:00.000Z";
    runtime.confirmationTemplate = null;
  });

  it("usa o texto pós-pagamento salvo, a saudação e o fuso do negócio", async () => {
    await sendPaymentConfirmation("appt-1");
    expect(runtime.sendTextMessage).toHaveBeenCalledWith(
      "token-biz-1",
      "98999990000",
      "Bem-vinda!\n\nPagamento confirmado para Ana em Barbearia, 28/09 às 12:00.",
    );
  });

  it("sempre usa a mensagem fixa de lembrete (mesmo com template salvo)", async () => {
    await sendBookingReminder("appt-1");
    expect(runtime.sendTextMessage).toHaveBeenCalledWith(
      "token-biz-1",
      "98999990000",
      "Bem-vinda! Ana, só estou passando aqui para lembrar que você tem um horário agendado conosco hoje às 12:00 🥰\nEspero por você, até breve! 👋",
    );
  });

  it("coloca a saudação antes da confirmação automática", async () => {
    await sendBookingConfirmation("appt-1");
    expect(runtime.sendTextMessage).toHaveBeenCalledWith(
      "token-biz-1",
      "98999990000",
      "Bem-vinda!\n\nOlá, Ana! Seu sinal foi recebido e seu horário de Corte está confirmado para 28/09 às 12:00 em Barbearia. Até lá! ✅",
    );
  });

  it("envia a confirmação sem prefixo quando não há saudação configurada", async () => {
    runtime.greeting = null;
    await sendBookingConfirmation("appt-1");
    expect(runtime.sendTextMessage).toHaveBeenCalledWith(
      "token-biz-1",
      "98999990000",
      "Olá, Ana! Seu sinal foi recebido e seu horário de Corte está confirmado para 28/09 às 12:00 em Barbearia. Até lá! ✅",
    );
  });

  it("formata data e hora em Fortaleza e Manaus", async () => {
    runtime.greeting = null;
    runtime.startsAt = "2026-09-28T02:00:00.000Z";
    runtime.timezone = "America/Fortaleza";
    await sendBookingReminder("appt-1");
    expect(runtime.sendTextMessage).toHaveBeenLastCalledWith(
      "token-biz-1",
      "98999990000",
      "Olá! Ana, só estou passando aqui para lembrar que você tem um horário agendado conosco hoje às 23:00 🥰\nEspero por você, até breve! 👋",
    );

    vi.clearAllMocks();
    runtime.timezone = "America/Manaus";
    await sendBookingReminder("appt-1");
    expect(runtime.sendTextMessage).toHaveBeenLastCalledWith(
      "token-biz-1",
      "98999990000",
      "Olá! Ana, só estou passando aqui para lembrar que você tem um horário agendado conosco hoje às 22:00 🥰\nEspero por você, até breve! 👋",
    );
  });

  it("envia mesmo com whatsapp_status desatualizado no banco, se a sessão está online", async () => {
    runtime.whatsappStatus = "desconectado";
    runtime.isConnected.mockResolvedValue(true);
    await sendPaymentConfirmation("appt-1");
    expect(runtime.isConnected).toHaveBeenCalledWith("token-biz-1");
    expect(runtime.sendTextMessage).toHaveBeenCalledTimes(1);
  });

  it("não envia quando a sessão do WhatsApp está offline, mesmo com status conectado no banco", async () => {
    runtime.whatsappStatus = "conectado";
    runtime.isConnected.mockResolvedValue(false);
    await sendPaymentConfirmation("appt-1");
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });

  it("não envia (e não lança) quando a checagem da sessão falha", async () => {
    runtime.isConnected.mockRejectedValue(new Error("timeout"));
    await expect(sendPaymentConfirmation("appt-1")).resolves.toBeUndefined();
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });

  it("resolve os campos do resumo (profissional, valor, data e hora)", async () => {
    runtime.greeting = null;
    runtime.confirmationTemplate =
      "❕ Resumo de seu agendamento:\n\n📅 Data: {Data}\n🕗 Hora: {Horario}\n🛠 Serviço: {Serviço}\n👤 Profissional: {Funcionario}\n💰 Valor: R$ {Valor} {Cliente}";
    await sendBookingConfirmation("appt-1");
    expect(runtime.sendTextMessage).toHaveBeenCalledWith(
      "token-biz-1",
      "98999990000",
      "❕ Resumo de seu agendamento:\n\n📅 Data: 28/09\n🕗 Hora: 12:00\n🛠 Serviço: Corte\n👤 Profissional: José\n💰 Valor: R$ 35,00 Ana",
    );
  });

  it("respeita antecedência de lembrete em minutos", () => {
    const now = new Date("2026-09-28T12:00:00.000Z");
    expect(isReminderDue("2026-09-28T12:15:00.000Z", now, 15)).toBe(true);
    expect(isReminderDue("2026-09-28T12:16:00.000Z", now, 15)).toBe(false);
    expect(isReminderDue("2026-09-28T11:59:00.000Z", now, 15)).toBe(false);
  });
});
