/**
 * Máscaras progressivas de campos brasileiros: a pontuação entra sozinha
 * conforme a pessoa digita e o campo aceita somente o formato padrão do Brasil.
 *
 * Telefone: DDD + número fixo ou celular (10 ou 11 dígitos, sem DDI "+55").
 * Documento: CPF (11 dígitos) ou CNPJ (14 dígitos), trocando a máscara sozinho.
 * Data: dia/mês/ano com barras (DD/MM/AAAA).
 */

const onlyDigits = (value: string) => value.replace(/\D/g, "");

/** Telefone BR progressivo: "9" → "(9" → "(11) 98888-7777" ou "(11) 3333-4444". */
export function maskPhoneBR(value: string): string {
  let digits = onlyDigits(value);
  // Aceita colar com DDI: "+55 11 98888-7777" vira "(11) 98888-7777".
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Documento progressivo: CPF até 11 dígitos, depois CNPJ até 14 dígitos. */
export function maskCpfCnpj(value: string, maxDigits = 14): string {
  const digits = onlyDigits(value).slice(0, Math.min(14, Math.max(11, maxDigits)));
  if (digits.length <= 11) {
    let out = digits.slice(0, 3);
    if (digits.length > 3) out += `.${digits.slice(3, 6)}`;
    if (digits.length > 6) out += `.${digits.slice(6, 9)}`;
    if (digits.length > 9) out += `-${digits.slice(9, 11)}`;
    return out;
  }
  let out = `${digits.slice(0, 2)}.${digits.slice(2, 5)}`;
  if (digits.length > 5) out += `.${digits.slice(5, 8)}`;
  if (digits.length > 8) out += `/${digits.slice(8, 12)}`;
  if (digits.length > 12) out += `-${digits.slice(12, 14)}`;
  return out;
}

/** Data BR progressiva: "28" → "28/1" → "28/10/2026" (DD/MM/AAAA). */
export function maskDateBR(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
