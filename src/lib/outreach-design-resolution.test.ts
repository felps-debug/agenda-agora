import { describe, expect, it } from "vitest";
import { businessOwnerCanEdit, resolveEffectiveOutreachDesign } from "./outreach-design-resolution";

const design = (background: string) => ({
  version: 1 as const,
  width: 1080,
  height: 1080,
  background,
  layers: [],
});

describe("precedência dos designs de divulgação", () => {
  it("prioriza a cópia do negócio e mantém o padrão como fallback", () => {
    expect(resolveEffectiveOutreachDesign(design("#111111"), design("#222222")).background).toBe(
      "#222222",
    );
    expect(resolveEffectiveOutreachDesign(design("#111111")).background).toBe("#111111");
  });

  it("uma nova versão padrão não substitui a cópia personalizada", () => {
    const override = design("#222222");
    const effective = resolveEffectiveOutreachDesign(design("#333333"), override);
    expect(effective.background).toBe("#222222");
  });

  it("recusa edição por quem não é proprietário do negócio", () => {
    expect(businessOwnerCanEdit("owner-a", "owner-a")).toBe(true);
    expect(businessOwnerCanEdit("owner-a", "owner-b")).toBe(false);
  });
});
