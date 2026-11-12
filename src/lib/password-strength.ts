/** Policy for new passwords; existing four digit PINs remain valid only for login. */
export function isStrongOwnerPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 128 &&
    /[a-z]/i.test(password) &&
    /[0-9]/.test(password)
  );
}
export const OWNER_PASSWORD_MESSAGE =
  "Use de 8 a 128 caracteres, com pelo menos uma letra e um número.";

/**
 * PIN definido pelo Master no dossiê: exatamente 4 dígitos (pedido do cliente em 2026-11-09).
 * O login por telefone envia `agendaagora:<PIN>`, então o Auth precisa guardar com esse prefixo.
 */
export const OWNER_PIN_PREFIX = "agendaagora:";
export function isOwnerPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
export const OWNER_PIN_MESSAGE = "O PIN deve ter exatamente 4 dígitos numéricos.";
