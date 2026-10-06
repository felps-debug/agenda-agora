import { describe, expect, it } from "vitest";
import { DEFAULT_PANEL1_APPEARANCE } from "@/lib/panel1-config";
import { liquidGlassTokens } from "./liquid-glass";

describe("liquidGlassTokens", () => {
  it("derives the material tint from the selected palette instead of hardcoding gold", () => {
    const blue = liquidGlassTokens(
      { ...DEFAULT_PANEL1_APPEARANCE, modal_active_background: "#175d6a" },
      "#e2f1f3",
    );
    const warm = liquidGlassTokens(
      { ...DEFAULT_PANEL1_APPEARANCE, modal_active_background: "#765333" },
      "#efe2d1",
    );

    expect(blue["--liquid-tint-rgb" as keyof typeof blue]).toBe("23 93 106");
    expect(warm["--liquid-tint-rgb" as keyof typeof warm]).toBe("118 83 51");
    expect(blue["--liquid-tint-rgb" as keyof typeof blue]).not.toBe(
      warm["--liquid-tint-rgb" as keyof typeof warm],
    );
  });
});
