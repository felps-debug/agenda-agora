// Integração com a Evolution API v2 (WhatsApp via QR Code / código de pareamento),
// hospedada pela própria plataforma (EasyPanel). Uma instância por negócio, todas sob
// a mesma chave global: sem custo por instância, ao contrário de provedores pagos.
// Requer EVOLUTION_API_URL (ex.: "https://evolution.seudominio.com") e EVOLUTION_API_KEY.
//
// Mesma interface do uazapi.server.ts. Aqui o "instanceToken" guardado por negócio é o
// NOME da instância (a Evolution endereça por nome e autentica com a chave global).

type EvolutionConnect = {
  base64?: string | null;
  code?: string | null;
  pairingCode?: string | null;
  qrcode?: { base64?: string | null; pairingCode?: string | null } | null;
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
  const baseUrl = process.env["EVOLUTION_API_URL"]?.trim().replace(/\/$/, "");
  const apiKey = process.env["EVOLUTION_API_KEY"]?.trim();
  if (!baseUrl || !apiKey)
    throw new Error("A integração de WhatsApp ainda não foi configurada pela plataforma.");
  return { baseUrl, apiKey };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, apiKey } = config();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
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
    // Nunca registra o corpo: pode conter chave, telefone ou mensagem.
    console.error(`Evolution API [${res.status}] ${path.split("?")[0]}.`);
    if ([401, 403].includes(res.status)) {
      const error = new Error("A credencial de WhatsApp é inválida ou não tem permissão.");
      error.name = "EvolutionCredentialError";
      throw error;
    }
    throw new Error("Falha na integração de WhatsApp. Tente novamente.");
  }
  return (text ? JSON.parse(text) : {}) as T;
}

function instanceSlug(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "negocio";
}

function toDataUrl(base64: string): string {
  return base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
}

export async function createBusinessInstance(name: string) {
  const instanceName = `${instanceSlug(name)}-${crypto.randomUUID().slice(0, 8)}`;
  await call("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName,
      qrcode: false,
      integration: "WHATSAPP-BAILEYS",
    }),
  });
  return { instanceId: instanceName, instanceToken: instanceName };
}

/** QR Code atual da instância, como data-url base64 pronta para <img>. */
export async function getQrCode(instanceToken: string): Promise<string | null> {
  const artifact = await startWhatsappConnection(instanceToken, { method: "qr" });
  return artifact?.method === "qr" ? artifact.qrCode : null;
}

/** Inicia uma conexão sem persistir QR ou código de pareamento. */
export async function startWhatsappConnection(
  instanceToken: string,
  input: { method: "qr" } | { method: "pairing_code"; phone: string },
): Promise<WhatsappConnectionArtifact | null> {
  const instance = encodeURIComponent(instanceToken);
  const query =
    input.method === "pairing_code"
      ? `?number=${normalizePairingPhone(input.phone)}`
      : "";
  const data = await call<EvolutionConnect>(`/instance/connect/${instance}${query}`);
  if (input.method === "qr") {
    const base64 = data.base64 ?? data.qrcode?.base64;
    return base64 ? { method: "qr", qrCode: toDataUrl(base64) } : null;
  }
  const pairingCode = data.pairingCode ?? data.qrcode?.pairingCode;
  if (pairingCode) return { method: "pairing_code", pairingCode };

  // A Evolution só devolve o código no PRIMEIRO connect da instância: depois de gerar um QR
  // (ex.: o dono trocou de aba) ele vem null, e restart não resolve (testado na 2.3.7).
  // Recria a instância com o mesmo nome, que é a credencial guardada, e tenta de novo.
  await deleteInstance(instanceToken);
  await call("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: instanceToken,
      qrcode: false,
      integration: "WHATSAPP-BAILEYS",
    }),
  });
  const retry = await call<EvolutionConnect>(`/instance/connect/${instance}${query}`);
  const retryCode = retry.pairingCode ?? retry.qrcode?.pairingCode;
  return retryCode ? { method: "pairing_code", pairingCode: retryCode } : null;
}

/** true quando o WhatsApp está conectado e pronto para enviar. */
export async function isConnected(instanceToken: string): Promise<boolean> {
  const data = await call<{ instance?: { state?: string }; state?: string }>(
    `/instance/connectionState/${encodeURIComponent(instanceToken)}`,
  );
  return (data.instance?.state ?? data.state) === "open";
}

/** Desconecta o aparelho vinculado (a instância continua existindo). */
export async function disconnect(instanceToken: string): Promise<void> {
  await call(`/instance/logout/${encodeURIComponent(instanceToken)}`, { method: "DELETE" });
}

/** Remove a instância por completo (uso administrativo, não faz parte do fluxo do painel). */
export async function deleteInstance(instanceToken: string): Promise<void> {
  await call(`/instance/delete/${encodeURIComponent(instanceToken)}`, { method: "DELETE" });
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
  await call(`/message/sendText/${encodeURIComponent(instanceToken)}`, {
    method: "POST",
    body: JSON.stringify({
      number: phoneToWhatsapp(phone),
      text: message,
    }),
  });
}
