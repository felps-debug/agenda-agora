/** Regras puras do login em /auth (T051); sem dependências de React ou Supabase. */

import { isStrongOwnerPassword, OWNER_PASSWORD_MESSAGE } from "../password-strength";

export const onlyDigits = (value: string) => value.replace(/\D/g, "");
const phoneLogin = (phone: string) => `${onlyDigits(phone)}@agenda.local`;
const phonePassword = (senha: string) => `agendaagora:${senha}`;

export const looksLikeEmail = (identifier: string) => identifier.includes("@");

export function loginInputMode(identifier: string) {
  const email = looksLikeEmail(identifier);
  return {
    email,
    label: "Senha",
    inputMode: "text",
    maxLength: email ? undefined : 128,
    pattern: undefined,
  } as const;
}

export type LoginCredentials = { kind: "owner" | "admin"; email: string; password: string };

/**
 * Decide o fluxo pelo formato do identificador, sem consultar role antes do login:
 * telefone + PIN de 4 dígitos (dono, fluxo atual) ou e-mail + senha do administrador.
 */
export function resolveLoginCredentials(identifier: string, secret: string): LoginCredentials {
  if (looksLikeEmail(identifier)) {
    const email = identifier.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");
    // E-mails sintéticos pertencem ao login por telefone (e à conta Master legada).
    if (email.endsWith("@agenda.local"))
      throw new Error("Entre com o telefone do estabelecimento.");
    return { kind: "admin", email, password: secret };
  }
  if (onlyDigits(identifier).length < 10) throw new Error("Informe o telefone com DDD.");
  const legacyPin = /^\d{4}$/.test(secret);
  if (!legacyPin && !isStrongOwnerPassword(secret)) {
    throw new Error(`Informe seu PIN de 4 dígitos ou sua senha. ${OWNER_PASSWORD_MESSAGE}`);
  }
  return {
    kind: "owner",
    email: phoneLogin(identifier),
    password: legacyPin ? phonePassword(secret) : secret,
  };
}

export type PostLoginDestination = "/painel" | "/painel/master";

/** Destino pela role lida do banco. */
export function postLoginDestination({ roles }: { roles: string[] }): PostLoginDestination | null {
  if (roles.includes("super_admin")) return "/painel/master";
  if (roles.includes("owner") || roles.includes("professional")) return "/painel";
  return null;
}
