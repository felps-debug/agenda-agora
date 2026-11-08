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
