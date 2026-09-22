import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeNowMin,
  computeOpenDays,
  computeSlots,
  hhmm,
  isValidCpfCnpj,
  minutesOf,
  shouldRequireDeposit,
  toIso,
} from "./booking.functions";

describe("isValidCpfCnpj", () => {
  it("valida dígitos verificadores e rejeita sequências", () => {
    expect(isValidCpfCnpj("529.982.247-25")).toBe(true);
    expect(isValidCpfCnpj("04.252.011/0001-10")).toBe(true);
    expect(isValidCpfCnpj("529.982.247-24")).toBe(false);
    expect(isValidCpfCnpj("111.111.111-11")).toBe(false);
  });
});

describe("minutesOf / hhmm", () => {
  it("converte HH:mm pra minutos e volta", () => {
    expect(minutesOf("09:30")).toBe(570);
    expect(minutesOf("00:00")).toBe(0);
    expect(hhmm(570)).toBe("09:30");
    expect(hhmm(0)).toBe("00:00");
  });
});

describe("toIso", () => {
  it("interpreta a data/hora no fuso de São Paulo (UTC-3)", () => {
    // 09:00 em São Paulo é 12:00 UTC.
    expect(toIso("2026-09-15", "09:00")).toBe("2026-09-15T12:00:00.000Z");
  });
});

describe("computeSlots", () => {
  const hours = [{ starts_at: "09:00:00", ends_at: "12:00:00" }];

  it("gera slots de 30 em 30 min que cabem o serviço inteiro dentro do expediente", () => {
    const slots = computeSlots({ hours, busy: [], durationMinutes: 60, nowMin: -1 });
    // último slot possível é 11:00 (11:00-12:00); 11:30 já estouraria o expediente
    expect(slots).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });

  it("não gera slot nenhum se o serviço não cabe no expediente", () => {
    const slots = computeSlots({ hours, busy: [], durationMinutes: 240, nowMin: -1 });
    expect(slots).toEqual([]);
  });

  it("remove slots que colidem com horário ocupado (agendamento ou bloqueio)", () => {
    // ocupado das 10:00 às 11:00
    const slots = computeSlots({ hours, busy: [[600, 660]], durationMinutes: 30, nowMin: -1 });
    expect(slots).not.toContain("10:00");
    expect(slots).not.toContain("10:30");
    expect(slots).toContain("09:30");
    expect(slots).toContain("11:00");
  });

  it("um agendamento que só encosta na borda (sem sobrepor) não bloqueia o slot vizinho", () => {
    // ocupado das 10:00 às 10:30 exatamente
    const slots = computeSlots({ hours, busy: [[600, 630]], durationMinutes: 30, nowMin: -1 });
    expect(slots).toContain("09:30"); // termina 10:00, não sobrepõe
    expect(slots).not.toContain("10:00"); // exatamente o horário ocupado
    expect(slots).toContain("10:30"); // começa quando o ocupado termina
  });

  it("corta horários que já passaram quando é hoje (nowMin >= 0)", () => {
    const slots = computeSlots({ hours, busy: [], durationMinutes: 30, nowMin: 600 }); // 10:00
    expect(slots).not.toContain("09:00");
    expect(slots).not.toContain("09:30");
    expect(slots).not.toContain("10:00"); // <= nowMin é excluído, não só <
    expect(slots).toContain("10:30");
  });
});

// T013 (US3) — escrito antes de T018/T019 existirem (data-model.md, FR-012).
// `shouldRequireDeposit` ainda não existe em booking.functions.ts: esse teste
// começa falhando até T018/T019 extraírem a checagem de `service.requires_deposit`
// usada por `reserveBooking` (hoje só olha `deposit_cents`, ver linha ~260) para
// essa função pura, com a assinatura esperada
// `shouldRequireDeposit(service: { requires_deposit: boolean; deposit_cents: number }): boolean`.
describe("shouldRequireDeposit", () => {
  it("não cobra sinal quando requires_deposit é false, mesmo com deposit_cents > 0", () => {
    expect(shouldRequireDeposit({ requires_deposit: false, deposit_cents: 5000 })).toBe(false);
  });

  it("cobra sinal quando requires_deposit é true e deposit_cents > 0", () => {
    expect(shouldRequireDeposit({ requires_deposit: true, deposit_cents: 5000 })).toBe(true);
  });

  it("não cobra sinal sem deposit_cents configurado, mesmo com requires_deposit true", () => {
    expect(shouldRequireDeposit({ requires_deposit: true, deposit_cents: 0 })).toBe(false);
  });
});

// T025 (US5) — computeNowMin/computeOpenDays extraídas de getAvailability/getOpenDays
// pra provar, sem banco, que minimum_notice_hours e list_dates_days do Panel1Config
// (contracts/server-functions.md, savePanel1Config) realmente mudam o resultado.
describe("computeNowMin (minimum_notice_hours do Panel1Config afeta getAvailability)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 15/09/2026 23:30 em São Paulo (UTC-3) = 16/09/2026 02:30 UTC.
    vi.setSystemTime(new Date("2026-09-16T02:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("com antecedência mínima 0, o corte é o minuto atual do próprio dia", () => {
    expect(computeNowMin("2026-09-15", "America/Sao_Paulo", 0)).toBe(23 * 60 + 30);
  });

  it("aumentar minimum_notice_hours pode bloquear o resto do dia de hoje", () => {
    // +2h de antecedência empurra o corte pra 01:30 do dia 16 — o dia 15 inteiro
    // (hoje) fica dentro da antecedência mínima e nenhum horário deve sobrar.
    expect(computeNowMin("2026-09-15", "America/Sao_Paulo", 2)).toBe(1440);
  });

  it("um dia bem no futuro continua livre de corte, independente da antecedência", () => {
    expect(computeNowMin("2026-09-20", "America/Sao_Paulo", 2)).toBe(-1);
  });
});

describe("computeOpenDays (list_dates_days do Panel1Config afeta getOpenDays)", () => {
  const allWeekdaysOpen = new Set([0, 1, 2, 3, 4, 5, 6]);

  it("retorna exatamente `target` dias quando o negócio abre todos os dias", () => {
    const seven = computeOpenDays({
      openWeekdays: allWeekdaysOpen,
      timezone: "America/Sao_Paulo",
      target: 7,
    });
    const fifteen = computeOpenDays({
      openWeekdays: allWeekdaysOpen,
      timezone: "America/Sao_Paulo",
      target: 15,
    });
    expect(seven).toHaveLength(7);
    expect(fifteen).toHaveLength(15);
  });

  it("só lista dias cujo weekday está aberto", () => {
    const onlyMonday = computeOpenDays({
      openWeekdays: new Set([1]),
      timezone: "America/Sao_Paulo",
      target: 3,
    });
    expect(onlyMonday).toHaveLength(3);
    expect(onlyMonday.every((d) => d.weekday === 1)).toBe(true);
  });
});
