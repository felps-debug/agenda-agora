import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware: () => ({
      inputValidator: () => ({ handler: (handler: unknown) => handler }),
    }),
    inputValidator: () => ({ handler: (handler: unknown) => handler }),
  }),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

const { appearancePatch, preferencesPatch } = await import("./panel1-config.functions");
const { normalizePanel1Config } = await import("./panel1-config");

describe("preferências parciais do Painel 1", () => {
  it("aceita opções omitidas e aplica os padrões para os três controles booleanos", () => {
    const patch = preferencesPatch.parse({});
    const effective = normalizePanel1Config({ preferences: patch }).preferences;

    expect(effective.notify_clients).toBe(true);
    expect(effective.cancellations_enabled).toBe(true);
    expect(effective.reschedule_enabled).toBe(false);
  });

  it("aceita e preserva o prazo valido de antecedencia", () => {
    const patch = preferencesPatch.parse({ minimum_notice_hours: 12 });
    const effective = normalizePanel1Config({ preferences: patch }).preferences;

    expect(effective.minimum_notice_hours).toBe(12);
  });
});

describe("aparência parcial do Painel 1 (patch salvo pelo servidor)", () => {
  it("aceita font_family e logo_fit junto com cores, sem exigir hex neles", () => {
    const patch = appearancePatch.parse({
      font_family: "oswald",
      logo_fit: "horizontal",
      header_background: "#123456",
    });
    expect(patch).toEqual({
      font_family: "oswald",
      logo_fit: "horizontal",
      header_background: "#123456",
    });
  });

  it("rejeita valor de font_family fora da lista fechada", () => {
    expect(() => appearancePatch.parse({ font_family: "comic-sans" })).toThrow();
  });

  it("rejeita valor de logo_fit fora da lista fechada", () => {
    expect(() => appearancePatch.parse({ logo_fit: "gigante" })).toThrow();
  });

  it("continua exigindo hex de 6 dígitos pros campos de cor", () => {
    expect(() => appearancePatch.parse({ header_background: "red" })).toThrow();
  });

  it("rejeita campo de aparência desconhecido", () => {
    expect(() => appearancePatch.parse({ nao_existe: "#123456" })).toThrow();
  });
});
