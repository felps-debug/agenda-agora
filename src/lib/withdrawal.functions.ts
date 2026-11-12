import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidCpf } from "@/lib/cpf";

export const withdrawalPixKeyTypes = ["cpf", "cnpj", "email", "telefone", "aleatoria"] as const;

/** Taxa fixa de saque da plataforma (decisão comercial de 05/10/2026). */
export const WITHDRAWAL_FEE_CENTS = 300;
/** Mínimo do `amount` (valor líquido) do POST /cashout/pix, conforme a documentação da AgPay. */
export const AGPAY_MIN_PAYOUT_CENTS = 1000;
/** O Pix enviado é o valor pedido menos a taxa; por isso o pedido mínimo inclui a taxa. */
export const MIN_WITHDRAWAL_CENTS = AGPAY_MIN_PAYOUT_CENTS + WITHDRAWAL_FEE_CENTS;

const cpfDigits = (value: string) => value.replace(/\D/g, "");


function isValidCnpj(value: string) {
  if (!/^[\d./\-\s]+$/.test(value)) return false;
  const digits = cpfDigits(value);
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return false;
  const weights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const checkDigit = (length: number) => {
    const sum = digits
      .slice(0, length)
      .split("")
      .reduce(
        (total, digit, index) => total + Number(digit) * weights[weights.length - length + index]!,
        0,
      );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return checkDigit(12) === Number(digits[12]) && checkDigit(13) === Number(digits[13]);
}

const validAreaCodes = new Set([
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "21",
  "22",
  "24",
  "27",
  "28",
  "31",
  "32",
  "33",
  "34",
  "35",
  "37",
  "38",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "51",
  "53",
  "54",
  "55",
  "61",
  "62",
  "63",
  "64",
  "65",
  "66",
  "67",
  "68",
  "69",
  "71",
  "73",
  "74",
  "75",
  "77",
  "79",
  "81",
  "82",
  "83",
  "84",
  "85",
  "86",
  "87",
  "88",
  "89",
  "91",
  "93",
  "94",
  "95",
  "96",
  "97",
  "98",
  "99",
]);

export function getWithdrawalPixKeyValidationError(
  type: (typeof withdrawalPixKeyTypes)[number],
  rawValue: string,
) {
  const value = rawValue.trim();
  const digits = cpfDigits(value);
  switch (type) {
    case "cpf":
      return isValidCpf(value) ? null : "Informe um CPF válido, com 11 dígitos verificadores.";
    case "cnpj":
      return isValidCnpj(value) ? null : "Informe um CNPJ válido, com 14 dígitos verificadores.";
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : "Informe um e-mail válido.";
    case "telefone": {
      const nationalDigits = digits.replace(/^55(?=\d{10,11}$)/, "");
      const areaCode = nationalDigits.slice(0, 2);
      return /^[\d\s()+.-]+$/.test(value) &&
        /^\d{10,11}$/.test(nationalDigits) &&
        validAreaCodes.has(areaCode)
        ? null
        : "Informe um telefone com DDD válido.";
    }
    case "aleatoria":
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
        ? null
        : "Informe uma chave aleatória no formato UUID.";
  }
}

export const saveWithdrawalPixKeyInput = z
  .object({
    businessId: z.string().uuid(),
    pixKey: z.string().trim().min(1, "Informe a chave PIX.").max(140),
    pixKeyType: z.enum(withdrawalPixKeyTypes),
  })
  .superRefine(({ pixKey, pixKeyType }, context) => {
    const message = getWithdrawalPixKeyValidationError(pixKeyType, pixKey);
    if (message) context.addIssue({ code: "custom", path: ["pixKey"], message });
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        amountCents: z.number().int().min(MIN_WITHDRAWAL_CENTS),
        idempotencyKey: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { createWithdrawal } = await import("./withdrawal.server");
    return createWithdrawal(
      context.supabase,
      context.userId,
      data.businessId,
      data.amountCents,
      data.idempotencyKey,
    );
  });

/**
 * Cadastra a chave PIX de saque do negócio; restrito ao dono (owner_id = auth.uid()).
 * A lógica de banco fica em withdrawal.server.ts, fora do bundle do client.
 */
export const saveWithdrawalPixKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveWithdrawalPixKeyInput.parse(data))
  .handler(async ({ context, data }) => {
    const { saveWithdrawalPixKeyForOwner } = await import("./withdrawal.server");
    return saveWithdrawalPixKeyForOwner(context.supabase, context.userId, data);
  });

export const saveWithdrawalPinInput = z.object({
  businessId: z.string().uuid(),
  pin: z.string().regex(/^\d{4}$/, "A senha deve ter 4 dígitos numéricos."),
});

export const verifyWithdrawalPinInput = saveWithdrawalPinInput;

/** Confirma a senha de transferência antes de efetuar o saque. */
export const verifyWithdrawalPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        pin: z.string().regex(/^\d{4}$/, "A senha deve ter 4 dígitos numéricos."),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { verifyWithdrawalPinForOwner } = await import("./withdrawal.server");
    return verifyWithdrawalPinForOwner(context.supabase, context.userId, data);
  });

/**
 * Cadastra a senha de transferência (4 dígitos) do negócio; restrito ao dono.
 * Apenas o hash é persistido. Preenchida uma única vez junto da chave Pix.
 */
export const saveWithdrawalPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveWithdrawalPinInput.parse(data))
  .handler(async ({ context, data }) => {
    const { saveWithdrawalPinForOwner } = await import("./withdrawal.server");
    return saveWithdrawalPinForOwner(context.supabase, context.userId, data);
  });

/** Informa se o negócio já cadastrou a senha de transferência. */
export const getWithdrawalPinStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ businessId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { getWithdrawalPinStatusForOwner } = await import("./withdrawal.server");
    return getWithdrawalPinStatusForOwner(context.supabase, context.userId, data);
  });

export const paymentPixModes = ["desabilitado", "opcional", "obrigatorio"] as const;

export const savePaymentRulesInput = z.object({
  businessId: z.string().uuid(),
  pixMode: z.enum(paymentPixModes),
  pixExceptionClients: z.array(z.string().trim().min(1).max(80)).max(200).default([]),
});

/** Regras de pagamento da carteira AgPay do negócio; restrito ao dono. */
export const savePaymentRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => savePaymentRulesInput.parse(data))
  .handler(async ({ context, data }) => {
    const { savePaymentRulesForOwner } = await import("./withdrawal.server");
    return savePaymentRulesForOwner(context.supabase, context.userId, data);
  });

/** Lê as regras de pagamento da carteira AgPay do negócio. */
export const getPaymentRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ businessId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { getPaymentRulesForOwner } = await import("./withdrawal.server");
    return getPaymentRulesForOwner(context.supabase, context.userId, data);
  });
