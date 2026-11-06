import { describe, expect, it } from "vitest";
import { shouldShowPopup, type Broadcast } from "./broadcast";

const base: Broadcast = {
  id: "b1",
  title: "Aviso",
  message: "Mensagem",
  createdAt: new Date("2026-11-06T12:00:00Z").toISOString(),
};

const seenBefore = new Date("2026-11-06T11:00:00Z").getTime();
const seenAfter = new Date("2026-11-06T13:00:00Z").getTime();

describe("shouldShowPopup (US3)", () => {
  it("mostra quando createdAt > seenAt e id não foi dispensado", () => {
    expect(shouldShowPopup(base, { seenAt: seenBefore, dismissedIds: new Set() })).toBe(true);
  });

  it("não mostra quando o id já foi dispensado (X do popup)", () => {
    expect(shouldShowPopup(base, { seenAt: seenBefore, dismissedIds: new Set(["b1"]) })).toBe(
      false,
    );
  });

  it("não mostra quando createdAt <= seenAt (já visto pelo sino)", () => {
    expect(shouldShowPopup(base, { seenAt: seenAfter, dismissedIds: new Set() })).toBe(false);
  });

  it("controle é por aviso: um novo id distinto ainda aparece", () => {
    const novo: Broadcast = { ...base, id: "b2" };
    expect(shouldShowPopup(novo, { seenAt: seenBefore, dismissedIds: new Set(["b1"]) })).toBe(true);
  });

  it("aceita dismissedIds como array além de Set", () => {
    expect(shouldShowPopup(base, { seenAt: seenBefore, dismissedIds: ["b1"] })).toBe(false);
    expect(shouldShowPopup(base, { seenAt: seenBefore, dismissedIds: ["outro"] })).toBe(true);
  });

  it("não mostra para broadcast ausente ou data inválida", () => {
    expect(shouldShowPopup(null, { seenAt: 0, dismissedIds: new Set() })).toBe(false);
    expect(shouldShowPopup(undefined, { seenAt: 0, dismissedIds: new Set() })).toBe(false);
    expect(
      shouldShowPopup(
        { ...base, createdAt: "data-invalida" },
        { seenAt: 0, dismissedIds: new Set() },
      ),
    ).toBe(false);
  });
});
