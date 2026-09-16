// Integração com a UazAPI (WhatsApp via QR Code / multi-dispositivo).
// Requer UAZAPI_BASE_URL (ex.: "https://free.uazapi.com" ou o domínio da conta
// contratada) e UAZAPI_TOKEN (token da instância, painel da UazAPI).
// Referência: pesquisa/uazapi/ no vault (OpenAPI v2.1.1 + notas de endpoints).

type UazapiInstance = {
  status?: "disconnected" | "connecting" | "connected" | "hibernated";
  qrcode?: string | null;
};

function config() {
  const baseUrl = process.env["UAZAPI_BASE_URL"];
  const token = process.env["UAZAPI_TOKEN"];
  if (!baseUrl || !token)
    throw new Error(
      "A integração de WhatsApp ainda não foi configurada pela plataforma.",
    );
  return { baseUrl: baseUrl.replace(/\/$/, ""), token };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, token } = config();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      token,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`UazAPI [${res.status}] ${path}: ${text}`);
    throw new Error(`Falha na integração de WhatsApp (${res.status}).`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * QR Code atual da instância, como data-url base64 pronta para <img>.
 * Na UazAPI, pedir um QR novo é o mesmo endpoint que inicia a conexão
 * (POST /instance/connect sem `phone`) — não existe um GET separado só de QR.
 */
export async function getQrCode(): Promise<string | null> {
  try {
    const data = await call<{ instance?: UazapiInstance }>("/instance/connect", {
      method: "POST",
      body: JSON.stringify({}),
    });
    return data.instance?.qrcode ?? null;
  } catch {
    return null;
  }
}

/** true quando o WhatsApp está conectado e pronto para enviar. */
export async function isConnected(): Promise<boolean> {
  try {
    const data = await call<{ instance?: UazapiInstance }>("/instance/status");
    return data.instance?.status === "connected";
  } catch {
    return false;
  }
}

/** Desconecta o aparelho vinculado (a instância continua existindo). */
export async function disconnect(): Promise<void> {
  try {
    await call("/instance/disconnect", { method: "POST" });
  } catch {
    // ignora: instância pode já estar desconectada
  }
}

export function phoneToWhatsapp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export async function sendTextMessage(
  phone: string,
  message: string,
): Promise<void> {
  await call("/send/text", {
    method: "POST",
    body: JSON.stringify({
      number: phoneToWhatsapp(phone),
      text: message,
    }),
  });
}
