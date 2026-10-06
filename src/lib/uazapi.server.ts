// Integração com a UazAPI (WhatsApp via QR Code / multi-dispositivo).
// Requer UAZAPI_BASE_URL (ex.: "https://free.uazapi.com" ou o domínio da conta
// contratada) e UAZAPI_TOKEN (token da instância, painel da UazAPI).
// Referência: pesquisa/uazapi/ no vault (OpenAPI v2.1.1 + notas de endpoints).

type UazapiInstance = {
  status?: "disconnected" | "connecting" | "connected" | "hibernated";
  qrcode?: string | null;
  qrCode?: string | null;
  paircode?: string | null;
  pairCode?: string | null;
  pairingCode?: string | null;
};

export type WhatsappConnectionArtifact =
  { method: "qr"; qrCode: string } | { method: "pairing_code"; pairingCode: string };

export function normalizePairingPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const nationalNumber = digits.startsWith("55") ? digits.slice(2) : digits;
  if (nationalNumber.length < 10 || nationalNumber.length > 11) {
    throw new Error("Informe um telefone brasileiro com DDD para gerar o código.");
  }
  return `55${nationalNumber}`;
}

function config() {
  const baseUrl = process.env["UAZAPI_BASE_URL"];
  if (!baseUrl)
    throw new Error("A integração de WhatsApp ainda não foi configurada pela plataforma.");
  return { baseUrl: baseUrl.replace(/\/$/, "") };
}

async function call<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const { baseUrl } = config();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        token,
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError")
      throw new Error("A conexão com WhatsApp excedeu o tempo limite.");
    throw new Error("Falha na integração de WhatsApp. Tente novamente.");
  }
  const text = await res.text();
  if (!res.ok) {
    console.error(`UazAPI [${res.status}] ${path}.`);
    if ([401, 403].includes(res.status)) {
      const error = new Error("A credencial de WhatsApp é inválida ou não tem permissão.");
      error.name = "UazapiCredentialError";
      throw error;
    }
    throw new Error("Falha na integração de WhatsApp. Tente novamente.");
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export async function createBusinessInstance(name: string) {
  const { baseUrl } = config();
  const adminToken = process.env["UAZAPI_ADMIN_TOKEN"]?.trim();
  if (!adminToken) {
    const error = new Error("A credencial administrativa de WhatsApp não está configurada.");
    error.name = "UazapiCredentialError";
    throw error;
  }
  const response = await fetch(`${baseUrl}/instance/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", admintoken: adminToken },
    body: JSON.stringify({ name: name.slice(0, 80), systemName: "Agenda Agora" }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("Não foi possível criar a instância de WhatsApp.");
  const payload = (await response.json()) as {
    token?: string;
    name?: string;
    instance?: { name?: string };
  };
  if (!payload.token) throw new Error("A resposta da integração de WhatsApp está incompleta.");
  return {
    instanceId: payload.name ?? payload.instance?.name ?? name,
    instanceToken: payload.token,
  };
}

/**
 * QR Code atual da instância, como data-url base64 pronta para <img>.
 * Na UazAPI, pedir um QR novo é o mesmo endpoint que inicia a conexão
 * (POST /instance/connect sem `phone`) — não existe um GET separado só de QR.
 */
export async function getQrCode(instanceToken: string): Promise<string | null> {
  const artifact = await startWhatsappConnection(instanceToken, { method: "qr" });
  return artifact?.method === "qr" ? artifact.qrCode : null;
}

/** Inicia uma conexão sem persistir QR ou código de pareamento. */
export async function startWhatsappConnection(
  instanceToken: string,
  input: { method: "qr" } | { method: "pairing_code"; phone: string },
): Promise<WhatsappConnectionArtifact | null> {
  const body = input.method === "qr" ? {} : { phone: normalizePairingPhone(input.phone) };
  const data = await call<{ instance?: UazapiInstance }>("/instance/connect", instanceToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (input.method === "qr") {
    const qrCode = data.instance?.qrcode ?? data.instance?.qrCode;
    return qrCode ? { method: "qr", qrCode } : null;
  }
  const pairingCode =
    data.instance?.paircode ?? data.instance?.pairCode ?? data.instance?.pairingCode;
  return pairingCode ? { method: "pairing_code", pairingCode } : null;
}

/** true quando o WhatsApp está conectado e pronto para enviar. */
export async function isConnected(instanceToken: string): Promise<boolean> {
  try {
    const data = await call<{ instance?: UazapiInstance }>("/instance/status", instanceToken);
    return data.instance?.status === "connected";
  } catch (error) {
    if (error instanceof Error && error.name === "UazapiCredentialError") throw error;
    if (error instanceof Error && error.name === "TimeoutError")
      throw new Error("A conexão com WhatsApp excedeu o tempo limite.");
    throw error;
  }
}

/** Desconecta o aparelho vinculado (a instância continua existindo). */
export async function disconnect(instanceToken: string): Promise<void> {
  try {
    await call("/instance/disconnect", instanceToken, { method: "POST" });
  } catch (error) {
    if (error instanceof Error && error.name === "UazapiCredentialError") throw error;
    if (error instanceof Error && error.name === "TimeoutError")
      throw new Error("A conexão com WhatsApp excedeu o tempo limite.");
    throw error;
  }
}

export function phoneToWhatsapp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export async function sendTextMessage(
  instanceToken: string,
  phone: string,
  message: string,
): Promise<void> {
  await call("/send/text", instanceToken, {
    method: "POST",
    body: JSON.stringify({
      number: phoneToWhatsapp(phone),
      text: message,
    }),
  });
}
