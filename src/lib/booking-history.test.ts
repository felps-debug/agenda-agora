import { describe, expect, it } from "vitest";
import {
  canRenderRescheduleForm,
  formatAppointmentDateTime,
  shouldRenderDepositStep,
} from "./booking-history";

describe("histórico público de agendamentos", () => {
  it("esconde o formulário de remarcação após cancelar ou remarcar", () => {
    expect(canRenderRescheduleForm("cancelado", true)).toBe(false);
    expect(canRenderRescheduleForm("agendado", false)).toBe(false);
    expect(canRenderRescheduleForm("agendado", true)).toBe(true);
  });

  it("esconde a etapa de pagamento em agendamento sem sinal", () => {
    expect(shouldRenderDepositStep("sem_sinal")).toBe(false);
    expect(shouldRenderDepositStep("pendente")).toBe(true);
    expect(shouldRenderDepositStep("pago")).toBe(true);
  });

  it.each([
    ["America/Manaus", "2099-01-06T14:30:00.000Z"],
    ["America/Fortaleza", "2099-01-06T13:30:00.000Z"],
    ["America/Sao_Paulo", "2099-01-06T13:30:00.000Z"],
  ])("formata o horário local do negócio (%s)", (timezone, startsAt) => {
    expect(formatAppointmentDateTime(startsAt, timezone)).toContain("10:30");
  });
});
