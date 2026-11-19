import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token de sessão da conta do cliente no painel público.
 *
 * O cliente não é um usuário do painel: a sessão é um token assinado com
 * HMAC-SHA256 usando o segredo do servidor. O token carrega o negócio e o
 * telefone (somente dígitos) e vale por 1 ano, para que o histórico continue
 * disponível mesmo depois de fechar o navegador.
 */

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 365;

const toBase64Url = (value: Buffer) => value.toString("base64url");

export type CustomerTokenPayload = { bid: string; phone: string };

export function signCustomerToken(
  bid: string,
  phone: string,
  secret: string,
  now = Date.now(),
): string {
  const body = toBase64Url(
    Buffer.from(JSON.stringify({ bid, phone, exp: now + TOKEN_TTL_MS })),
  );
  const signature = toBase64Url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${signature}`;
}

/** Retorna os dados da sessão quando o token é válido e não expirou. */
export function verifyCustomerToken(
  token: string,
  secret: string,
  now = Date.now(),
): CustomerTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      bid?: unknown;
      phone?: unknown;
      exp?: unknown;
    };
    if (typeof payload.bid !== "string" || typeof payload.phone !== "string") return null;
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;
    return { bid: payload.bid, phone: payload.phone };
  } catch {
    return null;
  }
}
