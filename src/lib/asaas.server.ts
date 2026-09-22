import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const ASAAS_USER_AGENT = "AgendaAgora/1.0";
const REQUEST_TIMEOUT_MS = 12_000;

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configuração obrigatória ausente: ${name}.`);
  return value;
}

function baseUrl() {
  const mode = process.env["ASAAS_ENV"] ?? "sandbox";
  if (mode !== "sandbox" && mode !== "production") {
    throw new Error("ASAAS_ENV deve ser sandbox ou production.");
  }
  return mode === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

function rootApiKey() {
  return requiredEnv("ASAAS_API_KEY");
}

function normalizedDocument(value: string) {
  return value.replace(/\D/g, "");
}

class AsaasApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
  ) {
    super(`Falha na comunicação com o Asaas (${status}).`);
    this.name = "AsaasApiError";
  }
}

type AsaasRequest = Omit<RequestInit, "headers" | "signal"> & {
  headers?: HeadersInit;
};

async function asaasFetch<T>(
  path: string,
  init: AsaasRequest,
  accessToken = rootApiKey(),
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  if ((method === "GET" || method === "DELETE") && init.body != null) {
    throw new Error(`${method} do Asaas não pode enviar body.`);
  }

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("User-Agent", ASAAS_USER_AGENT);
  headers.set("access_token", accessToken);
  if (init.body != null) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      method,
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error(`Asaas indisponível em ${method} ${path}:`, error);
    throw new Error("O Asaas não respondeu. Tente novamente em instantes.");
  }

  const text = await response.text();
  if (!response.ok) {
    console.error(`Asaas falhou [${response.status}] ${method} ${path}.`);
    throw new AsaasApiError(response.status, path);
  }

  return (text ? JSON.parse(text) : null) as T;
}

export type PixCharge = {
  providerPaymentId: string;
  status: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  expiresAt: string | null;
};

type AsaasCustomer = { id: string };
type AsaasList<T> = { data?: T[] };

export type AsaasPayment = {
  id: string;
  status: string;
  dueDate?: string;
  invoiceUrl?: string;
  deleted?: boolean;
};

type AsaasPixQrCode = {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
};

export async function findCustomerByDocument(
  accessToken: string,
  cpfCnpj: string,
): Promise<AsaasCustomer | null> {
  const params = new URLSearchParams({
    cpfCnpj: normalizedDocument(cpfCnpj),
    limit: "1",
  });
  const result = await asaasFetch<AsaasList<AsaasCustomer>>(
    `/customers?${params.toString()}`,
    { method: "GET" },
    accessToken,
  );
  return result.data?.[0] ?? null;
}

/** Localiza o pagador antes de criar, pois a API do Asaas aceita duplicados. */
export async function getOrCreateCustomer(input: {
  accessToken: string;
  name: string;
  cpfCnpj: string;
  phone?: string;
  externalReference: string;
}): Promise<string> {
  const existing = await findCustomerByDocument(input.accessToken, input.cpfCnpj);
  if (existing) return existing.id;

  try {
    const customer = await asaasFetch<AsaasCustomer>(
      "/customers",
      {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          cpfCnpj: normalizedDocument(input.cpfCnpj),
          mobilePhone: input.phone?.replace(/\D/g, "") || undefined,
          externalReference: input.externalReference,
          notificationDisabled: true,
        }),
      },
      input.accessToken,
    );
    return customer.id;
  } catch (error) {
    // Timeout não prova que o POST falhou. Consulte antes de permitir retry.
    const created = await findCustomerByDocument(input.accessToken, input.cpfCnpj).catch(
      () => null,
    );
    if (created) return created.id;
    throw error;
  }
}

export async function findPaymentByExternalReference(
  accessToken: string,
  externalReference: string,
): Promise<AsaasPayment | null> {
  const params = new URLSearchParams({ externalReference, limit: "1" });
  const result = await asaasFetch<AsaasList<AsaasPayment>>(
    `/payments?${params.toString()}`,
    { method: "GET" },
    accessToken,
  );
  return result.data?.[0] ?? null;
}

async function pixData(accessToken: string, payment: AsaasPayment): Promise<PixCharge> {
  if (payment.deleted) {
    throw new Error("A cobrança Pix desta reserva já foi cancelada.");
  }
  const qr = await asaasFetch<AsaasPixQrCode>(
    `/payments/${encodeURIComponent(payment.id)}/pixQrCode`,
    { method: "GET" },
    accessToken,
  );
  return {
    providerPaymentId: payment.id,
    status: payment.status,
    qrCode: qr.payload ?? null,
    qrCodeBase64: qr.encodedImage ?? null,
    ticketUrl: payment.invoiceUrl ?? null,
    expiresAt: qr.expirationDate ?? null,
  };
}

/**
 * Cria a cobrança na subconta do estabelecimento. Se houver comissão, somente
 * a comissão é enviada para a wallet master; o restante permanece na conta
 * criadora, que é a prestadora do serviço.
 */
export async function createPixCharge(input: {
  accessToken: string;
  amountCents: number;
  description: string;
  customerId: string;
  externalReference: string;
  commissionPercent?: number;
}): Promise<PixCharge> {
  const existing = await findPaymentByExternalReference(input.accessToken, input.externalReference);
  if (existing) return pixData(input.accessToken, existing);

  const commissionPercent = input.commissionPercent ?? 0;
  if (commissionPercent < 0 || commissionPercent >= 100) {
    throw new Error("A comissão Asaas deve estar entre 0 e 99,99%.");
  }
  const masterWalletId = commissionPercent > 0 ? requiredEnv("ASAAS_MASTER_WALLET_ID") : undefined;
  const split = masterWalletId
    ? [{ walletId: masterWalletId, percentualValue: commissionPercent }]
    : undefined;

  const dueDate = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });

  let payment: AsaasPayment;
  try {
    payment = await asaasFetch<AsaasPayment>(
      "/payments",
      {
        method: "POST",
        body: JSON.stringify({
          customer: input.customerId,
          billingType: "PIX",
          value: Number((input.amountCents / 100).toFixed(2)),
          dueDate,
          description: input.description,
          externalReference: input.externalReference,
          ...(split ? { split } : {}),
        }),
      },
      input.accessToken,
    );
  } catch (error) {
    const created = await findPaymentByExternalReference(
      input.accessToken,
      input.externalReference,
    ).catch(() => null);
    if (!created) throw error;
    payment = created;
  }

  return pixData(input.accessToken, payment);
}

export async function fetchPayment(
  accessToken: string,
  providerPaymentId: string,
): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(
    `/payments/${encodeURIComponent(providerPaymentId)}`,
    { method: "GET" },
    accessToken,
  );
}

export async function fetchPaymentStatus(
  accessToken: string,
  providerPaymentId: string,
): Promise<string> {
  return (await fetchPayment(accessToken, providerPaymentId)).status;
}

/** Remove somente cobranças ainda não liquidadas. */
export async function deletePendingPayment(
  accessToken: string,
  providerPaymentId: string,
): Promise<"deleted" | "received" | "confirmed" | "already_deleted"> {
  let payment: AsaasPayment;
  try {
    payment = await fetchPayment(accessToken, providerPaymentId);
  } catch (error) {
    if (error instanceof AsaasApiError && error.status === 404) {
      return "already_deleted";
    }
    throw error;
  }
  if (payment.status === "RECEIVED") return "received";
  if (payment.status === "CONFIRMED") return "confirmed";
  if (payment.deleted) return "already_deleted";

  await asaasFetch<{ deleted: boolean }>(
    `/payments/${encodeURIComponent(providerPaymentId)}`,
    { method: "DELETE" },
    accessToken,
  );
  return "deleted";
}

type CreateSubaccountInput = {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  incomeValue: number;
  address: string;
  addressNumber: string;
  province: string;
  postalCode: string;
  companyType?: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
};

type SubaccountResponse = {
  id?: string;
  apiKey?: string;
  walletId?: string;
  accessToken?: { apiKey?: string };
};

/** Cria a subconta não-BaaS e já registra o Webhook financeiro. */
export async function createSubaccount(
  input: CreateSubaccountInput,
): Promise<{ accountId: string | null; walletId: string; apiKey: string }> {
  const webhookToken = requiredEnv("ASAAS_WEBHOOK_TOKEN");
  if (webhookToken.length < 32 || webhookToken.length > 255) {
    throw new Error("ASAAS_WEBHOOK_TOKEN deve ter entre 32 e 255 caracteres.");
  }

  const account = await asaasFetch<SubaccountResponse>("/accounts", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      cpfCnpj: normalizedDocument(input.cpfCnpj),
      mobilePhone: input.mobilePhone.replace(/\D/g, ""),
      postalCode: input.postalCode.replace(/\D/g, ""),
      webhooks: [
        {
          name: "Agenda Agora — pagamentos",
          url: requiredEnv("ASAAS_WEBHOOK_URL"),
          email: requiredEnv("ASAAS_WEBHOOK_EMAIL"),
          enabled: true,
          interrupted: false,
          apiVersion: 3,
          authToken: webhookToken,
          sendType: "SEQUENTIALLY",
          events: [
            "PAYMENT_CONFIRMED",
            "PAYMENT_RECEIVED",
            "PAYMENT_OVERDUE",
            "PAYMENT_DELETED",
            "PAYMENT_REFUNDED",
            "PAYMENT_PARTIALLY_REFUNDED",
            "PAYMENT_SPLIT_DONE",
            "PAYMENT_SPLIT_DIVERGENCE_BLOCK",
            "PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED",
          ],
        },
      ],
    }),
  });

  const apiKey = account.apiKey ?? account.accessToken?.apiKey;
  if (!apiKey || !account.walletId) {
    throw new Error("O Asaas não retornou apiKey e walletId da subconta.");
  }
  return {
    accountId: account.id ?? null,
    walletId: account.walletId,
    apiKey,
  };
}

function encryptionKey() {
  const key = Buffer.from(requiredEnv("ASAAS_CREDENTIALS_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) {
    throw new Error("ASAAS_CREDENTIALS_ENCRYPTION_KEY deve ser Base64 de exatamente 32 bytes.");
  }
  return key;
}

export function encryptAsaasApiKey(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptAsaasApiKey(value: string) {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = value.split(".");
  if (version !== "v1" || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error("Credencial Asaas criptografada em formato inválido.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivEncoded, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function getRequiredWebhookToken() {
  const token = requiredEnv("ASAAS_WEBHOOK_TOKEN");
  if (token.length < 32 || token.length > 255) {
    throw new Error("ASAAS_WEBHOOK_TOKEN deve ter entre 32 e 255 caracteres.");
  }
  return token;
}

export const withdrawalPixKeyTypes = ["cpf", "cnpj", "email", "telefone", "aleatoria"] as const;

export const saveWithdrawalPixKeyInput = z.object({
  businessId: z.string().uuid(),
  pixKey: z.string().min(1).max(140),
  pixKeyType: z.enum(withdrawalPixKeyTypes),
});

/** Extraída pra ser testável sem precisar do middleware de auth — ver asaas.server.test.ts. */
export async function saveWithdrawalPixKeyForOwner(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: z.infer<typeof saveWithdrawalPixKeyInput>,
) {
  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", data.businessId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!business) throw new Error("Somente o dono pode cadastrar a chave PIX de saque.");

  const { error } = await supabase
    .from("businesses")
    .update({ withdrawal_pix_key: data.pixKey, withdrawal_pix_key_type: data.pixKeyType })
    .eq("id", data.businessId);
  if (error) throw new Error(error.message);

  return { businessId: data.businessId, pixKey: data.pixKey, pixKeyType: data.pixKeyType };
}

/** Cadastra a chave PIX de saque do negócio; restrito ao dono (owner_id = auth.uid()). */
export const saveWithdrawalPixKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveWithdrawalPixKeyInput.parse(data))
  .handler(async ({ context, data }) =>
    saveWithdrawalPixKeyForOwner(context.supabase, context.userId, data),
  );
