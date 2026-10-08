import { describe, expect, it } from "vitest";
import { DEFAULT_PANEL1_APPEARANCE } from "@/lib/panel1-config";
import { liquidGlassHueShift, liquidGlassTokens } from "./liquid-glass";

describe("liquidGlassTokens", () => {
  it("deriva a luz do vidro da paleta selecionada, sem dourado fixo", () => {
    const blue = liquidGlassTokens(
      { ...DEFAULT_PANEL1_APPEARANCE, modal_active_background: "#175d6a" },
      "#e2f1f3",
    );
    const warm = liquidGlassTokens(
      { ...DEFAULT_PANEL1_APPEARANCE, modal_active_background: "#765333" },
      "#efe2d1",
    );

    expect(blue["--liquid-tint-rgb" as keyof typeof blue]).toBe("93 142 151");
    expect(warm["--liquid-tint-rgb" as keyof typeof warm]).toBe("159 135 112");
    expect(blue["--liquid-tint-rgb" as keyof typeof blue]).not.toBe(
      warm["--liquid-tint-rgb" as keyof typeof warm],
    );
  });

  it("gira os reflexos dourados para o matiz do destaque", () => {
    expect(Math.abs(liquidGlassHueShift("#f0b75e"))).toBeLessThanOrEqual(5);
    expect(liquidGlassHueShift("#3b82f6")).toBeGreaterThan(100);
    expect(liquidGlassHueShift("#888888")).toBe(0);
  });
});
