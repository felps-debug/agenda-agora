import { createHmac, timingSafeEqual } from "node:crypto";

const REQUEST_TIMEOUT_MS = 8_000;

export function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configuração obrigatória ausente: ${name}.`);
  return value;
}

export function baseUrl() {
  return "https://agpay.services/api/v1";
}

/** Caminho sem query string ou fragmento, para não registrar dados sensíveis. */
export function sanitizeAgpayPath(path: string) {
  return path.split(/[?#]/, 1)[0] ?? "";
}

export class AgpayApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly providerMessage: string | null = null,
    public readonly errors: unknown = null,
  ) {
    super(`Falha na comunicação com o AgPay (${status}).`);
    this.name = "AgpayApiError";
  }
}

type AgpayRequest = Omit<RequestInit, "headers" | "signal"> & {
  headers?: HeadersInit;
};

export async function agpayFetch<T>(path: string, init: AgpayRequest = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const safePath = sanitizeAgpayPath(path);
  if ((method === "GET" || method === "DELETE") && init.body != null) {
    throw new Error(`${method} do AgPay não pode enviar body.`);
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${requiredEnv("AGPAY_API_TOKEN")}`);
  headers.set("Accept", "application/json");
  if (init.body != null) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    const targetUrl = `${baseUrl()}${path}`;
    const proxyUrl = process.env["AGPAY_EGRESS_PROXY_URL"]?.trim();
    const proxySecret = process.env["AGPAY_EGRESS_PROXY_SECRET"]?.trim();
    if (proxyUrl && !proxySecret)
      throw new Error("Configuração obrigatória ausente: AGPAY_EGRESS_PROXY_SECRET.");
    response = await fetch(proxyUrl || targetUrl, {
      ...(proxyUrl
        ? {
            method: "POST",
            body: JSON.stringify({
              url: targetUrl,
              method,
              headers: Object.fromEntries(headers),
              body: init.body ?? null,
            }),
          }
        : { ...init, method, headers, redirect: "manual" }),
      headers: proxyUrl
        ? { "Content-Type": "application/json", "X-Proxy-Secret": proxySecret! }
        : headers,
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("AgPay indisponível", {
      method,
      path: safePath,
      errorType: error instanceof Error ? error.name : typeof error,
    });
    throw new Error("O AgPay não respondeu. Tente novamente em instantes.");
  }

  const text = await response.text();
  if (response.status >= 300 && response.status < 400) {
    console.error(
      `AgPay retornou redirecionamento inesperado [${response.status}] ${method} ${safePath}.`,
    );
    throw new AgpayApiError(response.status, safePath);
  }

  if (!response.ok) {
    let providerMessage: string | null = null;
    let errors: unknown = null;
    try {
      const payload = JSON.parse(text) as { message?: unknown; errors?: unknown };
      providerMessage = typeof payload.message === "string" ? payload.message : null;
      errors = payload.errors ?? null;
    } catch {
      // Keep non-JSON provider response bodies out of logs and user-facing errors.
    }
    console.error("AgPay falhou", {
      status: response.status,
      method,
      path: safePath,
      providerMessage,
    });
    throw new AgpayApiError(response.status, safePath, providerMessage, errors);
  }

  return (text ? JSON.parse(text) : null) as T;
}

export type PixCharge = {
  providerPaymentId: string;
  status: string;
  qrCode: string | null;
  qrCodeBase64: null;
  ticketUrl: null;
  expiresAt: string | null;
};

type AgpayPixResponse = {
  success: boolean;
  data: {
    transaction_uuid: string;
    status: string;
    pix_code?: string | null;
    expires_at?: string | null;
  };
};

export type AgpayPayment = {
  providerPaymentId: string;
  status: string;
  amount?: string;
  fee?: string;
  amountNet?: string;
  type?: string;
  externalId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type AgpayTransactionResponse = {
  success: boolean;
  data: {
    uuid: string;
    status: string;
    amount?: string;
    fee?: string;
    amount_net?: string;
    type?: string;
    external_id?: string | null;
    created_at?: string;
    updated_at?: string;
  };
};

export async function createPixCharge(input: {
  amountCents: number;
  payerName: string;
  payerEmail: string;
  payerCpf: string;
}): Promise<PixCharge> {
  const response = await agpayFetch<AgpayPixResponse>("/payments/pix", {
    method: "POST",
    body: JSON.stringify({
      amount: input.amountCents / 100,
      payer_name: input.payerName,
      payer_email: input.payerEmail,
      payer_cpf: input.payerCpf,
    }),
  });

  return {
    providerPaymentId: response.data.transaction_uuid,
    status: response.data.status,
    qrCode: response.data.pix_code?.trim() || null,
    qrCodeBase64: null,
    ticketUrl: null,
    expiresAt: response.data.expires_at ?? null,
  };
}

export type CashoutPix = {
  providerRef: string | null;
  status: string | null;
  providerFeeCents: number | null;
};

export async function createCashoutPix(input: {
  amountCents: number;
  pixKey: string;
}): Promise<CashoutPix> {
  // A documentação da AgPay define `amount` como valor líquido com mínimo de R$ 10,00. Abaixo
  // disso a API responde "aceito" mas o saque nunca é executado (saque 630, 06/10/2026), então
  // a validação precisa acontecer aqui, antes da chamada.
  if (!Number.isInteger(input.amountCents) || input.amountCents < 1000) {
    throw new Error("O valor mínimo do saque Pix é R$ 10,00.");
  }
  // A documentação atual do AgPay devolve o saque em `withdrawal` (não em
  // `data`). Mantemos `data` como compatibilidade defensiva com respostas
  // antigas, mas a ausência de `withdrawal` não pode transformar um saque
  // aceito pelo provedor em uma falha local.
  const response = await agpayFetch<{
    success?: boolean;
    withdrawal?: {
      uuid?: string | number;
      id?: string | number;
      status?: string;
      fee?: number | string;
    };
    data?: { uuid?: string | number; id?: string | number; status?: string; fee?: number | string };
  }>("/cashout/pix", {
    method: "POST",
    body: JSON.stringify({ amount: input.amountCents / 100, pix_key: input.pixKey }),
  });
  const withdrawal = response.withdrawal ?? response.data;
  const providerRef = withdrawal?.uuid ?? withdrawal?.id;
  if (
    response.success === false ||
    !withdrawal ||
    providerRef === undefined ||
    providerRef === null
  ) {
    throw new AgpayApiError(422, "/cashout/pix");
  }
  const fee = Number(withdrawal.fee);
  return {
    providerRef: String(providerRef),
    status: withdrawal.status ?? null,
    providerFeeCents: Number.isFinite(fee) ? Math.round(fee * 100) : null,
  };
}

export async function fetchPayment(providerPaymentId: string): Promise<AgpayPayment> {
  const response = await agpayFetch<AgpayTransactionResponse>(
    `/transactions/${encodeURIComponent(providerPaymentId)}`,
  );
  const payment = response.data;
  return {
    providerPaymentId: payment.uuid,
    status: payment.status,
    ...(payment.amount !== undefined ? { amount: payment.amount } : {}),
    ...(payment.fee !== undefined ? { fee: payment.fee } : {}),
    ...(payment.amount_net !== undefined ? { amountNet: payment.amount_net } : {}),
    ...(payment.type !== undefined ? { type: payment.type } : {}),
    ...(payment.external_id !== undefined ? { externalId: payment.external_id } : {}),
    ...(payment.created_at !== undefined ? { createdAt: payment.created_at } : {}),
    ...(payment.updated_at !== undefined ? { updatedAt: payment.updated_at } : {}),
  };
}

export async function fetchPaymentStatus(providerPaymentId: string): Promise<string> {
  return (await fetchPayment(providerPaymentId)).status;
}

export function verifyAgpayWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
): boolean {
  if (!signature) return false;

  const expected = createHmac("sha256", requiredEnv("AGPAY_API_TOKEN"))
    .update(rawBody, "utf8")
    .digest();

  let received: Buffer;
  try {
    received = Buffer.from(signature.trim(), "hex");
  } catch {
    return false;
  }

  return received.length === expected.length && timingSafeEqual(received, expected);
}
