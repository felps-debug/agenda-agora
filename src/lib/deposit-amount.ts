export type DepositMode = "fixed" | "percent";

export type ServiceDepositConfig = {
  requires_deposit: boolean;
  deposit_mode: DepositMode;
  deposit_percent_bps: number;
  price_cents: number;
  deposit_cents: number;
};

const MAX_BPS = 10_000;

function assertCents(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} deve ser um inteiro de centavos não negativo.`);
  }
}

function assertBps(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_BPS) {
    throw new RangeError("O percentual do sinal deve ficar entre 0% e 100%.");
  }
}

/**
 * Valor do sinal cobrado no agendamento, em centavos. No modo percentual o valor
 * sai sempre do preço atual; `deposit_cents` fica só como sombra para retorno seguro.
 */
export function effectiveDepositCents(service: ServiceDepositConfig): number {
  if (service.deposit_mode !== "fixed" && service.deposit_mode !== "percent") {
    throw new RangeError("Modo de sinal inválido.");
  }
  assertCents(service.price_cents, "price_cents");
  assertCents(service.deposit_cents, "deposit_cents");
  assertBps(service.deposit_percent_bps);

  if (!service.requires_deposit) return 0;
  if (service.deposit_mode === "fixed") return service.deposit_cents;
  return Math.round((service.price_cents * service.deposit_percent_bps) / MAX_BPS);
}

/** Exigir sinal sem um valor positivo é uma configuração inválida do serviço. */
export function assertRequiredDepositAmount(requiresDeposit: boolean, amountCents: number): void {
  if (requiresDeposit && amountCents <= 0) {
    throw new RangeError(
      "Informe um valor de sinal maior que R$ 0,00 ou desative a exigência de sinal.",
    );
  }
}

/**
 * Converte o percentual digitado na UI (0–100, até duas casas) em pontos-base.
 * Arredonda o produto para absorver o erro binário (12.34 * 100 = 1233.999…) e
 * rejeita valores que não sejam de fato múltiplos de 0,01.
 */
export function percentToBps(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new RangeError("O percentual do sinal deve ficar entre 0% e 100%.");
  }
  const scaled = percent * 100;
  const bps = Math.round(scaled);
  if (Math.abs(scaled - bps) > 1e-6) {
    throw new RangeError("O percentual do sinal aceita no máximo duas casas decimais.");
  }
  return bps;
}

function formatDecimalBR(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
}

/** Texto do campo da tela de sinal na unidade escolhida (reais ou percentual). */
export function depositFieldText(
  service: Pick<
    ServiceDepositConfig,
    "price_cents" | "deposit_cents" | "deposit_mode" | "deposit_percent_bps"
  >,
  unit: DepositMode,
): string {
  if (unit === "percent") {
    const bps =
      service.deposit_mode === "percent"
        ? service.deposit_percent_bps
        : service.price_cents > 0
          ? Math.min(
              MAX_BPS,
              Math.round((service.deposit_cents / service.price_cents) * MAX_BPS),
            )
          : 0;
    return formatDecimalBR(bps / 100);
  }
  const cents =
    service.deposit_mode === "percent"
      ? Math.round((service.price_cents * service.deposit_percent_bps) / MAX_BPS)
      : service.deposit_cents;
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Converte o texto digitado em `amount` para o servidor: centavos (modo fixo) ou
 * pontos-base (modo percentual). Lança RangeError quando o texto não é um número válido.
 */
export function parseDepositField(text: string, unit: DepositMode): number {
  const parsed = Number(text.trim().replace(",", "."));
  if (text.trim() === "" || !Number.isFinite(parsed) || parsed < 0) {
    throw new RangeError("Informe um valor válido.");
  }
  if (unit === "percent") return percentToBps(parsed);
  return Math.round(parsed * 100);
}

/** Troca a unidade mantendo o que o dono já digitou (R$ ⇄ % do preço do serviço). */
export function convertDepositField(
  text: string,
  from: DepositMode,
  to: DepositMode,
  priceCents: number,
): string {
  if (from === to) return text;
  let amount: number;
  try {
    amount = parseDepositField(text, from);
  } catch {
    return text;
  }
  const config = {
    price_cents: priceCents,
    deposit_cents: from === "fixed" ? amount : 0,
    deposit_mode: from,
    deposit_percent_bps: from === "percent" ? amount : 0,
  } as const;
  return depositFieldText(config, to);
}
