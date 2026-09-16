import { describe, expect, it } from "vitest";
import { permissionForStatusChange } from "./appointments.functions";

// Regressão pro bug corrigido em 2026-09: as permissões granulares
// (cancel/complete/reopen_appointment) existiam na UI mas nada checava elas.
describe("permissionForStatusChange", () => {
  it("cancelar exige cancel_appointment", () => {
    expect(permissionForStatusChange("agendado", "cancelado")).toBe("cancel_appointment");
    expect(permissionForStatusChange("confirmado", "cancelado")).toBe("cancel_appointment");
  });

  it("concluir exige complete_appointment", () => {
    expect(permissionForStatusChange("confirmado", "concluido")).toBe("complete_appointment");
  });

  it("sair de cancelado/concluído de volta pra ativo exige reopen_appointment", () => {
    expect(permissionForStatusChange("cancelado", "agendado")).toBe("reopen_appointment");
    expect(permissionForStatusChange("concluido", "confirmado")).toBe("reopen_appointment");
  });

  it("cancelado -> cancelado (sem mudança real) e cancelado -> concluído não contam como reabrir", () => {
    // reopenableFrom cobre os dois lados aqui, então não é "reopen"; cai na regra de concluir
    expect(permissionForStatusChange("cancelado", "concluido")).toBe("complete_appointment");
  });

  it("transições neutras (ex.: agendado -> confirmado) não exigem permissão específica", () => {
    expect(permissionForStatusChange("agendado", "confirmado")).toBeNull();
    expect(permissionForStatusChange("agendado", "bloqueado")).toBeNull();
  });
});
