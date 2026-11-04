import { describe, expect, it } from "vitest";
// T032: escrito antes de T035. Contrato esperado de `./deposit-amount`:
// - `effectiveDepositCents(service)`: requires_deposit ? (deposit_mode === "percent"
//   ? Math.round(price_cents * deposit_percent_bps / 10000) : deposit_cents) : 0.
//   Lança erro para modo desconhecido, centavos negativos/não inteiros e
//   pontos-base fora de 0–10000 ou não inteiros (data-model.md, FR-011/012).
// - `percentToBps(percent)`: percentual da UI (0–100, até duas casas) em pontos-base.
import {
  assertRequiredDepositAmount,
  convertDepositField,
  depositFieldText,
  effectiveDepositCents,
  parseDepositField,
  percentToBps,
} from "./deposit-amount";

type ServiceDeposit = Parameters<typeof effectiveDepositCents>[0];

const percent = (price_cents: number, deposit_percent_bps: number): ServiceDeposit => ({
  requires_deposit: true,
  deposit_mode: "percent",
  deposit_percent_bps,
  price_cents,
  deposit_cents: 0,
});

describe("effectiveDepositCents — modo percentual", () => {
  it("cobra 10% de R$ 100 como R$ 10 (teste independente da US5)", () => {
    expect(effectiveDepositCents(percent(10_000, 1_000))).toBe(1_000);
  });

  it.each([
    // [preço, bps, esperado]
    [1_999, 1_000, 200], // 199,9 → 200
    [1_005, 5_000, 503], // 502,5 → 503 (meio arredonda para cima)
    [333, 3_333, 111], // 110,9889 → 111
    [1, 4_999, 0], // 0,4999 → 0
    [4_990, 1_250, 624], // 12,5% de R$ 49,90 = 623,75 → 624
  ])("arredonda para o centavo mais próximo: %i × %i bps = %i", (price, bps, expected) => {
    expect(effectiveDepositCents(percent(price, bps))).toBe(expected);
  });

  it("0% gera sinal zero (reserva sem Pix)", () => {
    expect(effectiveDepositCents(percent(10_000, 0))).toBe(0);
  });

  it("100% cobra o preço inteiro", () => {
    expect(effectiveDepositCents(percent(8_750, 10_000))).toBe(8_750);
  });

  it("preço zero gera sinal zero mesmo com percentual", () => {
    expect(effectiveDepositCents(percent(0, 5_000))).toBe(0);
  });

  it("ignora a sombra deposit_cents e recalcula a partir do preço", () => {
    expect(effectiveDepositCents({ ...percent(10_000, 1_000), deposit_cents: 9_999 })).toBe(1_000);
  });
});

describe("effectiveDepositCents — legado fixo e sem sinal", () => {
  it("serviço fixo legado continua cobrando deposit_cents, sem olhar preço/percentual", () => {
    expect(
      effectiveDepositCents({
        requires_deposit: true,
        deposit_mode: "fixed",
        deposit_percent_bps: 0,
        price_cents: 10_000,
        deposit_cents: 2_500,
      }),
    ).toBe(2_500);
  });

  it.each(["fixed", "percent"] as const)(
    "requires_deposit=false nunca cobra (modo %s)",
    (deposit_mode) => {
      expect(
        effectiveDepositCents({
          requires_deposit: false,
          deposit_mode,
          deposit_percent_bps: 5_000,
          price_cents: 10_000,
          deposit_cents: 2_500,
        }),
      ).toBe(0);
    },
  );
});

describe("exigência de sinal", () => {
  it("permite valor zero quando o serviço não exige sinal", () => {
    expect(() => assertRequiredDepositAmount(false, 0)).not.toThrow();
  });

  it("explica em português que o valor precisa ser positivo quando exige sinal", () => {
    expect(() => assertRequiredDepositAmount(true, 0)).toThrow(
      "Informe um valor de sinal maior que R$ 0,00 ou desative a exigência de sinal.",
    );
  });

  it("aceita sinal positivo quando a exigência está ligada", () => {
    expect(() => assertRequiredDepositAmount(true, 500)).not.toThrow();
  });
});

describe("effectiveDepositCents — rejeita configuração inválida", () => {
  it.each([-1, 10_001, 12.5, Number.NaN])("pontos-base fora de 0–10000 inteiros: %s", (bps) => {
    expect(() => effectiveDepositCents(percent(10_000, bps))).toThrow();
  });

  it("modo desconhecido", () => {
    expect(() =>
      effectiveDepositCents({
        ...percent(10_000, 1_000),
        deposit_mode: "percentual" as ServiceDeposit["deposit_mode"],
      }),
    ).toThrow();
  });

  it.each([
    ["preço negativo", { ...percent(-100, 1_000) }],
    ["preço fracionado", { ...percent(100.5, 1_000) }],
    [
      "sinal fixo negativo",
      {
        requires_deposit: true,
        deposit_mode: "fixed",
        deposit_percent_bps: 0,
        price_cents: 10_000,
        deposit_cents: -1,
      },
    ],
  ] as [string, ServiceDeposit][])("centavos inválidos: %s", (_label, service) => {
    expect(() => effectiveDepositCents(service)).toThrow();
  });
});

describe("percentToBps", () => {
  it.each([
    [0, 0],
    [10, 1_000],
    [12.34, 1_234], // 12.34 * 100 = 1233.9999… em ponto flutuante
    [0.01, 1],
    [100, 10_000],
  ])("%s%% → %i bps", (value, expected) => {
    expect(percentToBps(value)).toBe(expected);
  });

  it.each([-1, -0.01, 100.01, 101, 12.345, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejeita percentual fora de 0–100 ou com mais de duas casas: %s",
    (value) => {
      expect(() => percentToBps(value)).toThrow();
    },
  );
});

describe("campo da tela de sinal (US5)", () => {
  const fixed = { price_cents: 10_000, deposit_cents: 2_500, deposit_mode: "fixed", deposit_percent_bps: 0 } as const;
  const percent = { price_cents: 10_000, deposit_cents: 3_000, deposit_mode: "percent", deposit_percent_bps: 3_000 } as const;

  it("mostra o sinal na unidade em que o serviço foi salvo", () => {
    expect(depositFieldText(fixed, "fixed")).toBe("25,00");
    expect(depositFieldText(percent, "percent")).toBe("30");
  });

  it("converte entre reais e percentual usando o preço atual", () => {
    expect(depositFieldText(fixed, "percent")).toBe("25");
    expect(depositFieldText(percent, "fixed")).toBe("30,00");
  });

  it("percentual com casas decimais usa vírgula", () => {
    expect(depositFieldText({ ...percent, deposit_percent_bps: 1_234 }, "percent")).toBe("12,34");
  });

  it("serviço sem preço não gera divisão por zero", () => {
    expect(depositFieldText({ ...fixed, price_cents: 0 }, "percent")).toBe("0");
  });

  it("parseDepositField devolve centavos no modo fixo e pontos-base no percentual", () => {
    expect(parseDepositField("25,50", "fixed")).toBe(2_550);
    expect(parseDepositField("30", "percent")).toBe(3_000);
    expect(parseDepositField("12,34", "percent")).toBe(1_234);
  });

  it("parseDepositField recusa vazio, negativo, texto e percentual acima de 100", () => {
    expect(() => parseDepositField("", "fixed")).toThrow();
    expect(() => parseDepositField("-5", "fixed")).toThrow();
    expect(() => parseDepositField("abc", "percent")).toThrow();
    expect(() => parseDepositField("101", "percent")).toThrow();
  });

  it("trocar a unidade preserva o que o dono digitou", () => {
    expect(convertDepositField("30", "percent", "fixed", 10_000)).toBe("30,00");
    expect(convertDepositField("25,00", "fixed", "percent", 10_000)).toBe("25");
    expect(convertDepositField("lixo", "fixed", "percent", 10_000)).toBe("lixo");
    expect(convertDepositField("30", "percent", "percent", 10_000)).toBe("30");
  });

  it("o cálculo do sinal percentual arredonda para centavos", () => {
    const service = { requires_deposit: true, deposit_mode: "percent", deposit_percent_bps: 3_333, price_cents: 5_000, deposit_cents: 0 } as const;
    expect(effectiveDepositCents(service)).toBe(1_667);
  });
});
