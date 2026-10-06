import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBusinessInstance,
  disconnect,
  isConnected,
  normalizePairingPhone,
  sendTextMessage,
  startWhatsappConnection,
} from "./evolution.server";
import { whatsappProviderName } from "./whatsapp-provider.server";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env["EVOLUTION_API_URL"];
  delete process.env["EVOLUTION_API_KEY"];
  delete process.env["WHATSAPP_PROVIDER"];
});

function configure() {
  process.env["EVOLUTION_API_URL"] = "https://evolution.test/";
  process.env["EVOLUTION_API_KEY"] = "chave-global";
}

describe("cliente Evolution API", () => {
  it("falha com mensagem amigável quando a plataforma não configurou a integração", async () => {
    await expect(sendTextMessage("inst", "98999990000", "Olá")).rejects.toThrow(
      "ainda não foi configurada",
    );
  });

  it("envia a chave global no header apikey, aplica timeout e endereça pelo nome da instância", async () => {
    configure();
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return Promise.resolve(new Response("{}"));
    });
    vi.stubGlobal("fetch", fetchMock);
    await sendTextMessage("barbearia-a-1a2b3c4d", "(98) 99999-0000", "Olá");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://evolution.test/message/sendText/barbearia-a-1a2b3c4d");
    expect(new Headers(init.headers).get("apikey")).toBe("chave-global");
    expect(JSON.parse(init.body as string)).toEqual({ number: "5598999990000", text: "Olá" });
  });

  it("cria instância única por negócio sem expor a chave global", async () => {
    configure();
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("{}")));
    vi.stubGlobal("fetch", fetchMock);
    const a = await createBusinessInstance("Barbearia do João!");
    const b = await createBusinessInstance("Barbearia do João!");
    expect(a.instanceId).toMatch(/^barbearia-do-joao-[0-9a-f]{8}$/);
    expect(a.instanceToken).toBe(a.instanceId);
    expect(a.instanceId).not.toBe(b.instanceId);
    expect(JSON.stringify(a)).not.toContain("chave-global");
    expect(fetchMock.mock.calls[0]![0]).toBe("https://evolution.test/instance/create");
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toMatchObject({
      instanceName: a.instanceId,
      integration: "WHATSAPP-BAILEYS",
    });
  });

  it("devolve o QR como data-url, aceitando base64 puro ou já prefixado", async () => {
    configure();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ base64: "AAAA" }))),
    );
    await expect(startWhatsappConnection("inst", { method: "qr" })).resolves.toEqual({
      method: "qr",
      qrCode: "data:image/png;base64,AAAA",
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ base64: "data:image/png;base64,BB" }))),
    );
    await expect(startWhatsappConnection("inst", { method: "qr" })).resolves.toEqual({
      method: "qr",
      qrCode: "data:image/png;base64,BB",
    });
  });

  it("gera código de pareamento passando o número normalizado", async () => {
    configure();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ pairingCode: "ABCD-EFGH" })));
    vi.stubGlobal("fetch", fetchMock);
    const artifact = await startWhatsappConnection("inst", {
      method: "pairing_code",
      phone: "(98) 99999-0000",
    });
    expect(artifact).toEqual({ method: "pairing_code", pairingCode: "ABCD-EFGH" });
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://evolution.test/instance/connect/inst?number=5598999990000",
    );
  });

  it("recria a instância com o mesmo nome quando o código vem null depois de um QR", async () => {
    configure();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ pairingCode: null, base64: "QR" })))
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ pairingCode: "ZC1B4162" })));
    vi.stubGlobal("fetch", fetchMock);
    const artifact = await startWhatsappConnection("inst", {
      method: "pairing_code",
      phone: "(98) 99999-0000",
    });
    expect(artifact).toEqual({ method: "pairing_code", pairingCode: "ZC1B4162" });
    const calls = fetchMock.mock.calls.map(([url, init]) => [url, init?.method ?? "GET"]);
    expect(calls).toEqual([
      ["https://evolution.test/instance/connect/inst?number=5598999990000", "GET"],
      ["https://evolution.test/instance/delete/inst", "DELETE"],
      ["https://evolution.test/instance/create", "POST"],
      ["https://evolution.test/instance/connect/inst?number=5598999990000", "GET"],
    ]);
    expect(JSON.parse(fetchMock.mock.calls[2]![1]!.body as string)).toMatchObject({
      instanceName: "inst",
    });
  });

  it("considera conectado só no estado open", async () => {
    configure();
    for (const [state, expected] of [
      ["open", true],
      ["connecting", false],
      ["close", false],
    ] as const) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(JSON.stringify({ instance: { state } }))),
      );
      await expect(isConnected("inst")).resolves.toBe(expected);
    }
  });

  it("desconecta pelo logout da instância", async () => {
    configure();
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await disconnect("inst");
    expect(fetchMock.mock.calls[0]![0]).toBe("https://evolution.test/instance/logout/inst");
    expect(fetchMock.mock.calls[0]![1]!.method).toBe("DELETE");
  });

  it("converte timeout e credencial inválida em erros seguros", async () => {
    configure();
    const timeout = new Error("timeout");
    timeout.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));
    await expect(sendTextMessage("inst", "98999990000", "Olá")).rejects.toThrow(
      "A conexão com WhatsApp excedeu o tempo limite.",
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("segredo", { status: 401 })));
    await expect(sendTextMessage("inst", "98999990000", "Olá")).rejects.toMatchObject({
      name: "EvolutionCredentialError",
      message: "A credencial de WhatsApp é inválida ou não tem permissão.",
    });
  });

  it("rejeita telefone de pareamento incompleto", () => {
    expect(() => normalizePairingPhone("9999")).toThrow("telefone brasileiro com DDD");
  });
});

describe("seletor de provedor", () => {
  it("mantém UazAPI por padrão e só troca com WHATSAPP_PROVIDER=evolution", () => {
    expect(whatsappProviderName()).toBe("uazapi");
    process.env["WHATSAPP_PROVIDER"] = "Evolution";
    expect(whatsappProviderName()).toBe("evolution");
    process.env["WHATSAPP_PROVIDER"] = "qualquer-coisa";
    expect(whatsappProviderName()).toBe("uazapi");
  });
});
