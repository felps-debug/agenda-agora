import { describe, expect, it } from "vitest";
import {
  buildGreetingMessage,
  parseIncomingWhatsapp,
  shouldSendGreeting,
} from "./whatsapp-greeting.server";

function mockAdmin(repliedRecently: boolean) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gt: () => ({
              maybeSingle: async () => ({
                data: repliedRecently ? { replied_at: new Date().toISOString() } : null,
                error: null,
              }),
            }),
          }),
        }),
      }),
    }),
  };
}

describe("webhook de mensagens recebidas", () => {
  it("lê o formato da UazAPI", () => {
    const parsed = parseIncomingWhatsapp({
      event: "messages",
      instance: "token-1",
      data: {
        key: { remoteJid: "5598999990000@s.whatsapp.net", fromMe: false, id: "ABC" },
        pushName: "Maria Silva",
        message: { conversation: "Oi, quero agendar" },
      },
    });
    expect(parsed).toMatchObject({
      senderPhone: "5598999990000",
      pushName: "Maria Silva",
      text: "Oi, quero agendar",
    });
  });

  it("lê o envelope oficial atual da UazAPI com mensagem normalizada", () => {
    const parsed = parseIncomingWhatsapp({
      EventType: "messages",
      owner: "5511999999999",
      token: "token-ficticio",
      BaseUrl: "https://uazapi.test",
      instanceName: "atendimento",
      message: {
        id: "message-1",
        messageid: "message-1",
        chatid: "5511888887777@s.whatsapp.net",
        sender: "5511888887777@s.whatsapp.net",
        senderName: "Contato Teste",
        fromMe: false,
        isGroup: false,
        messageType: "Conversation",
        text: "Olá, gostaria de agendar.",
      },
    });

    expect(parsed).toEqual({
      fromMe: false,
      isGroup: false,
      senderPhone: "5511888887777",
      pushName: "Contato Teste",
      text: "Olá, gostaria de agendar.",
      messageId: "message-1",
      messageTimestamp: null,
    });
  });

  it("lê o formato MESSAGES_UPSERT da Evolution", () => {
    const parsed = parseIncomingWhatsapp({
      event: "messages.upsert",
      instance: "loja-abc",
      data: {
        key: { remoteJid: "5511988887777@s.whatsapp.net", fromMe: false },
        pushName: "João",
        message: { extendedTextMessage: { text: "Qual o link?" } },
      },
    });
    expect(parsed).toMatchObject({ senderPhone: "5511988887777", text: "Qual o link?" });
  });

  it("usa remoteJidAlt quando remoteJid e um LID", () => {
    const parsed = parseIncomingWhatsapp({
      event: "messages.upsert",
      instance: "loja-abc",
      data: {
        key: {
          remoteJid: "123456789012345@lid",
          remoteJidAlt: "5511999998888@s.whatsapp.net",
          fromMe: false,
        },
        message: { conversation: "Oi" },
      },
    });

    expect(parsed).toMatchObject({ senderPhone: "5511999998888", text: "Oi" });
  });

  it("ignora LID sem numero alternativo discavel", () => {
    expect(
      parseIncomingWhatsapp({
        event: "messages.upsert",
        data: { key: { remoteJid: "123456789012345@lid", fromMe: false }, message: {} },
      }),
    ).toBeNull();
  });

  it("ignora mensagens próprias, grupos e remetentes inválidos", () => {
    expect(
      parseIncomingWhatsapp({
        event: "messages",
        data: {
          key: { remoteJid: "5598999990000@s.whatsapp.net", fromMe: true },
          message: { conversation: "oi" },
        },
      }),
    ).toBeNull();
    expect(
      parseIncomingWhatsapp({
        event: "messages",
        data: {
          key: { remoteJid: "120363012345@g.us", fromMe: false },
          message: { conversation: "oi grupo" },
        },
      }),
    ).toBeNull();
    expect(parseIncomingWhatsapp({ event: "messages", data: {} })).toBeNull();
    expect(parseIncomingWhatsapp(null)).toBeNull();
  });

  it("monta a saudação com {Cliente}, {Saudacao} e {Link}", () => {
    const text = buildGreetingMessage(
      "👋 {negocio} {Cliente}, seja bem-vindo!\n\nAgende em {Link}",
      { name: "Studio C", slug: "studio-c", greeting: "Olá!" },
      "Ana Paula",
    );
    expect(text).toBe(
      "👋 Studio C Ana, seja bem-vindo!\n\nAgende em https://app.agendagora.company/agendar/studio-c",
    );
  });

  it("respeita o cooldown de 30 min por remetente", async () => {
    await expect(
      shouldSendGreeting(mockAdmin(false) as never, "biz-1", "5598999990000"),
    ).resolves.toBe(true);
    await expect(
      shouldSendGreeting(mockAdmin(true) as never, "biz-1", "5598999990000"),
    ).resolves.toBe(false);
  });
});
