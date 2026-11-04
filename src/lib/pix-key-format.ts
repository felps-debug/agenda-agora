import { withdrawalPixKeyTypes } from "@/lib/withdrawal.functions";

export type PixKeyMaskType = (typeof withdrawalPixKeyTypes)[number];

/** Mantém apenas os caracteres válidos por tipo. */
const pixDigits = (value: string) => value.replace(/\D/g, "");

const maskCpf = (value: string) => {
  const d = pixDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2")
    .replace(/\.(\d{3})\.(\d{3})-(\d{1,2}).*$/, ".$1.$2-$3");
};

const maskCnpj = (value: string) => {
  const d = pixDigits(value).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2")
    .replace(/(-\d{2})\d+?$/, "$1");
};

const maskTelefone = (value: string) => {
  // Descarta o código do país e aceita 10 ou 11 dígitos nacionais.
  let d = pixDigits(value);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)})${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)})${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)})${d.slice(2, 7)}-${d.slice(7)}`;
};

const maskAleatoria = (value: string) => {
  const hex = value
    .toLowerCase()
    .replace(/[^0-9a-f]/g, "")
    .slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ]
    .filter(Boolean)
    .join("-");
};

const maskEmail = (value: string) => value.replace(/\s/g, "").toLowerCase();

/** Aplica a pontuação no padrão brasileiro Pix conforme o tipo da chave. */
export function maskPixKey(
  type: PixKeyMaskType,
  raw: string,
): string {
  switch (type) {
    case "cpf":
      return maskCpf(raw);
    case "cnpj":
      return maskCnpj(raw);
    case "telefone":
      return maskTelefone(raw);
    case "email":
      return maskEmail(raw);
    case "aleatoria":
      return maskAleatoria(raw);
  }
}
