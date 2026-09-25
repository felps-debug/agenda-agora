/** Regras puras do login em /auth (T051); sem dependências de React ou Supabase. */

export const onlyDigits = (value: string) => value.replace(/\D/g, "");
const phoneLogin = (phone: string) => `${onlyDigits(phone)}@agenda.local`;
const phonePassword = (senha: string) => `agendaagora:${senha}`;

/** Mínimo local para administradores; a política final de senha fica no Supabase Auth. */
export const ADMIN_PASSWORD_MIN_LENGTH = 12;

export const looksLikeEmail = (identifier: string) => identifier.includes("@");

export type LoginCredentials = { kind: "owner" | "admin"; email: string; password: string };

/**
 * Decide o fluxo pelo formato do identificador, sem consultar role antes do login:
 * telefone + PIN de 4 dígitos (dono, fluxo atual) ou e-mail + senha forte (administrador).
 */
export function resolveLoginCredentials(identifier: string, secret: string): LoginCredentials {
  if (looksLikeEmail(identifier)) {
    const email = identifier.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");
    // E-mails sintéticos pertencem ao login por telefone (e à conta Master legada).
    if (email.endsWith("@agenda.local"))
      throw new Error("Entre com o telefone do estabelecimento.");
    if (secret.length < ADMIN_PASSWORD_MIN_LENGTH) {
      throw new Error(`A senha deve ter pelo menos ${ADMIN_PASSWORD_MIN_LENGTH} caracteres.`);
    }
    return { kind: "admin", email, password: secret };
  }
  if (onlyDigits(identifier).length < 10) throw new Error("Informe o telefone com DDD.");
  if (!/^\d{4}$/.test(secret)) throw new Error("A senha deve ter exatamente 4 dígitos.");
  return { kind: "owner", email: phoneLogin(identifier), password: phonePassword(secret) };
}

export type PostLoginDestination = "/painel" | "/painel/master";

/** Destino pela role lida do banco. */
export function postLoginDestination({ roles }: { roles: string[] }): PostLoginDestination | null {
  if (roles.includes("super_admin")) return "/painel/master";
  if (roles.includes("owner")) return "/painel";
  return null;
}
