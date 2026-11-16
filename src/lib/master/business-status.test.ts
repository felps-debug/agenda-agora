import { describe, expect, it } from "vitest";
import { isBusinessActive, businessStatusLabel } from "./business-status";

describe("business status presentation", () => {
  it.each([
    ["ativo", true],
    ["suspenso", false],
    ["cancelado", false],
    ["unexpected", false],
  ])("treats %s as active: %s", (status, expected) => {
    expect(isBusinessActive(status)).toBe(expected);
  });

  it.each([
    ["ativo", "Ativo"],
    ["suspenso", "Suspenso"],
    ["cancelado", "Cancelado"],
    ["unexpected", "Desconhecido"],
  ])("labels %s as %s", (status, expected) => {
    expect(businessStatusLabel(status)).toBe(expected);
  });
});
