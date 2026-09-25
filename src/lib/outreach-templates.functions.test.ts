import { afterEach, describe, expect, it, vi } from "vitest";

// T004 (US1) — escrito antes de T005/T006 existirem (contracts/server-functions.md).
// A rejeição de não-super_admin em saveOutreachTemplate/setOutreachTemplateActive é
// garantida centralmente pelo helper assertSuperAdmin (T003), que ambas as funções
// devem usar (ver tasks.md T005). Testamos o helper diretamente aqui.
//
// A personalização (placeholders) é testada contra `applyOutreachPlaceholders`,
// exportado por `src/lib/outreach-templates.placeholders.ts` (T006), com a
// assinatura esperada `applyOutreachPlaceholders(body: string, business: {
// name: string; category: string | null; phone: string | null; address: string | null; slug: string;
// }): string`, mapeando {nome_empresa}/{categoria}/{telefone}/{endereco}/{link_publico}
// (link_publico -> `/agendar/{slug}`), com placeholder ausente virando string vazia.
// Esse arquivo ainda não existe — este teste começa falhando até T006 terminar.

afterEach(() => {
  vi.doUnmock("@/integrations/supabase/client.server");
});

describe("assertSuperAdmin (autorização usada por saveOutreachTemplate/setOutreachTemplateActive)", () => {
  it("rejeita usuário que não é super_admin", async () => {
    vi.doMock("@/integrations/supabase/client.server", () => ({
      supabaseAdmin: {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      },
    }));
    const { assertSuperAdmin } = await import("./auth/require-super-admin");
    // T053: a guarda recebe a sessão validada (role no banco + aal2).
    await expect(
      assertSuperAdmin({ userId: "user-comum", claims: { aal: "aal2" } }),
    ).rejects.toThrow("Acesso restrito ao painel master.");
  });

  it("permite usuário super_admin", async () => {
    vi.doMock("@/integrations/supabase/client.server", () => ({
      supabaseAdmin: {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { role: "super_admin" }, error: null }),
              }),
            }),
          }),
        }),
      },
    }));
    const { assertSuperAdmin } = await import("./auth/require-super-admin");
    await expect(
      assertSuperAdmin({ userId: "user-master", claims: { aal: "aal2" } }),
    ).resolves.toBeDefined();
  });
});

describe("applyOutreachPlaceholders (helper de placeholders, src/lib/outreach-templates.placeholders.ts)", () => {
  const businessA = {
    name: "Studio A",
    category: "Cabelo",
    phone: "11999990000",
    address: "Rua A, 1",
    slug: "studio-a",
  };
  const businessB = {
    name: "Studio B",
    category: "Unhas",
    phone: "11988880000",
    address: "Rua B, 2",
    slug: "studio-b",
  };
  const body =
    "Fala, {nome_empresa}! Categoria: {categoria}. Fone: {telefone}. End: {endereco}. Link: {link_publico}";

  it("personalização nunca vaza dado de outro businessId", async () => {
    const { applyOutreachPlaceholders } = await import("./outreach-templates.placeholders");

    const resultA = applyOutreachPlaceholders(body, businessA);
    const resultB = applyOutreachPlaceholders(body, businessB);

    expect(resultA).toContain(businessA.name);
    expect(resultA).toContain(businessA.phone);
    expect(resultA).toContain(businessA.address);
    expect(resultA).toContain(`/agendar/${businessA.slug}`);
    expect(resultA).not.toContain(businessB.name);
    expect(resultA).not.toContain(businessB.phone);
    expect(resultA).not.toContain(businessB.address);
    expect(resultA).not.toContain(businessB.slug);

    expect(resultB).toContain(businessB.name);
    expect(resultB).not.toContain(businessA.name);
  });

  it("campo dinâmico ausente vira string vazia, sem quebrar o restante do texto", async () => {
    const { applyOutreachPlaceholders } = await import("./outreach-templates.placeholders");
    const businessSemDados = {
      name: "Studio C",
      category: null,
      phone: null,
      address: null,
      slug: "studio-c",
    };

    const result = applyOutreachPlaceholders(body, businessSemDados);

    expect(result).toBe("Fala, Studio C! Categoria: . Fone: . End: . Link: /agendar/studio-c");
  });
});
