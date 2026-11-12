/** Validação de CPF (11 dígitos + dígitos verificadores). Função pura, sem dependências. */
const onlyDigits = (value: string) => value.replace(/\D/g, "");

export function isValidCpf(value: string) {
  if (!/^[\d.\-\s]+$/.test(value)) return false;
  const digits = onlyDigits(value);
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const checkDigit = (length: number) => {
    const sum = digits
      .slice(0, length)
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
}
