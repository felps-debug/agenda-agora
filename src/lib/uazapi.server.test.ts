import { afterEach, describe, expect, it, vi } from "vitest";
import { createBusinessInstance, sendTextMessage } from "./uazapi.server";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env["UAZAPI_BASE_URL"];
  delete process.env["UAZAPI_ADMIN_TOKEN"];
});

describe("cliente UazAPI", () => {
  it("aplica timeout nas requisições", async () => {
    process.env["UAZAPI_BASE_URL"] = "https://uazapi.test";
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return Promise.resolve(new Response("{}"));
    });
    vi.stubGlobal("fetch", fetchMock);
    await sendTextMessage("token-instancia", "98999990000", "Olá");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("cria instância com a credencial administrativa e devolve o token apenas ao servidor", async () => {
    process.env["UAZAPI_BASE_URL"] = "https://uazapi.test";
    process.env["UAZAPI_ADMIN_TOKEN"] = "admin-teste";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ name: "biz-a", token: "instance-secret" })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(createBusinessInstance("Barbearia A")).resolves.toEqual({
      instanceId: "biz-a",
      instanceToken: "instance-secret",
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://uazapi.test/instance/init");
    expect(new Headers(init.headers).get("admintoken")).toBe("admin-teste");
  });

  it("converte timeout em mensagem segura", async () => {
    process.env["UAZAPI_BASE_URL"] = "https://uazapi.test";
    const timeout = new Error("timeout");
    timeout.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));
    await expect(sendTextMessage("token-instancia", "98999990000", "Olá")).rejects.toThrow(
      "A conexão com WhatsApp excedeu o tempo limite.",
    );
  });

  it("transforma credencial inválida em erro sanitizado", async () => {
    process.env["UAZAPI_BASE_URL"] = "https://uazapi.test";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("segredo", { status: 401 })));
    await expect(sendTextMessage("token-instancia", "98999990000", "Olá")).rejects.toMatchObject({
      name: "UazapiCredentialError",
      message: "A credencial de WhatsApp é inválida ou não tem permissão.",
    });
  });

  it("normaliza telefone nacional com código do Brasil", async () => {
    process.env["UAZAPI_BASE_URL"] = "https://uazapi.test";
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("{}")));
    vi.stubGlobal("fetch", fetchMock);
    await sendTextMessage("token-instancia", "(98) 99999-0000", "Olá");
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string).number).toBe("5598999990000");
    expect(new Headers(fetchMock.mock.calls[0]![1]!.headers).get("token")).toBe("token-instancia");
  });

  it("mantém tokens de instância isolados entre dois negócios", async () => {
    process.env["UAZAPI_BASE_URL"] = "https://uazapi.test";
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("{}")));
    vi.stubGlobal("fetch", fetchMock);
    await sendTextMessage("token-negocio-a", "98999990000", "A");
    await sendTextMessage("token-negocio-b", "98999990001", "B");
    expect(new Headers(fetchMock.mock.calls[0]![1]!.headers).get("token")).toBe("token-negocio-a");
    expect(new Headers(fetchMock.mock.calls[1]![1]!.headers).get("token")).toBe("token-negocio-b");
  });
});
