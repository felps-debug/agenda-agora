import { z } from "zod";

const envSchema = z.object({
  MASTER_RETURN_PIN: z
    .string()
    .regex(/^\d{6,12}$/)
    .optional(),
  MASTER_SECURITY_PIN: z
    .string()
    .regex(/^\d{6,12}$/)
    .optional(),
  SDR_TOKEN_SECRET: z.string().min(32).optional(),
  ALLOWED_APP_ORIGINS: z.string().optional(),
  WHATSAPP_WEBHOOK_SECRET: z.string().min(32).optional(),
  PUBLIC_APP_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse({
  MASTER_RETURN_PIN: process.env["MASTER_RETURN_PIN"],
  MASTER_SECURITY_PIN: process.env["MASTER_SECURITY_PIN"],
  SDR_TOKEN_SECRET: process.env["SDR_TOKEN_SECRET"],
  ALLOWED_APP_ORIGINS: process.env["ALLOWED_APP_ORIGINS"],
  WHATSAPP_WEBHOOK_SECRET: process.env["WHATSAPP_WEBHOOK_SECRET"],
  PUBLIC_APP_URL: process.env["PUBLIC_APP_URL"],
});

if (!parsed.success) {
  throw new Error("Configuração inválida de segurança no ambiente do servidor.");
}

const env = parsed.data;
const isProduction = process.env["NODE_ENV"] === "production";

function required<T>(name: string, value: T | undefined): T {
  if (value === undefined && isProduction) {
    throw new Error(`A variável ${name} precisa ser configurada no ambiente do servidor.`);
  }
  if (value === undefined) {
    throw new Error(`A variável ${name} precisa ser configurada para usar esta função.`);
  }
  return value;
}

export function getMasterReturnPin() {
  return required("MASTER_RETURN_PIN", env.MASTER_RETURN_PIN);
}

export function getMasterSecurityPin() {
  return required("MASTER_SECURITY_PIN", env.MASTER_SECURITY_PIN);
}

export function getSdrTokenSecret() {
  return required("SDR_TOKEN_SECRET", env.SDR_TOKEN_SECRET);
}

export function getWhatsAppWebhookSecret() {
  return required("WHATSAPP_WEBHOOK_SECRET", env.WHATSAPP_WEBHOOK_SECRET);
}

export function getPublicAppUrl() {
  return required("PUBLIC_APP_URL", env.PUBLIC_APP_URL);
}

export function getAllowedAppOrigins() {
  const value = required("ALLOWED_APP_ORIGINS", env.ALLOWED_APP_ORIGINS);
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).origin);
  if (!origins.length) throw new Error("ALLOWED_APP_ORIGINS precisa conter ao menos uma origem.");
  return new Set(origins);
}
