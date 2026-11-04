import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token de sessão do painel do SDR.
 *
 * O SDR não é um usuário do Supabase Auth: a sessão é um token assinado com
 * HMAC-SHA256 using SDR_TOKEN_SECRET from the server environment. Tokens expire after 7 days.
 */

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const toBase64Url = (value: Buffer) => value.toString("base64url");

export function signSdrToken(sdrId: string, secret: string, now = Date.now()): string {
  const body = toBase64Url(Buffer.from(JSON.stringify({ sid: sdrId, exp: now + TOKEN_TTL_MS })));
  const signature = toBase64Url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${signature}`;
}

/** Retorna o `sdrId` quando o token é válido e não expirou; `null` caso contrário. */
export function verifySdrToken(token: string, secret: string, now = Date.now()): string | null {
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
      sid?: unknown;
      exp?: unknown;
    };
    if (typeof payload.sid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp <= now) return null;
    return payload.sid;
  } catch {
    return null;
  }
}
