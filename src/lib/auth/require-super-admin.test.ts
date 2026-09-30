import { beforeEach, describe, expect, it, vi } from "vitest";

type RoleRow = { role: string } | null;

const db = vi.hoisted(() => ({
  result: { data: null as RoleRow, error: null as { message: string } | null },
  filters: [] as Array<[string, unknown]>,
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: db.from },
}));

import { assertSuperAdmin, getSuperAdminStatus } from "./require-super-admin";

type GuardContext = Parameters<typeof assertSuperAdmin>[0];

const adminId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";

function session(userId: string, extraClaims: object = {}) {
  return {
    userId,
    claims: { sub: userId, role: "authenticated", ...extraClaims },
  } as unknown as GuardContext;
}

function roleInDatabase(row: RoleRow, error: { message: string } | null = null) {
  db.result = { data: row, error };
}

beforeEach(() => {
  db.filters = [];
  db.from.mockReset();
  db.from.mockImplementation(() => {
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        db.filters.push([column, value]);
        return query;
      },
      maybeSingle: async () => db.result,
    };
    return query;
  });
});

describe("assertSuperAdmin: role atual no banco", () => {
  it("autoriza super_admin por e-mail e senha e devolve o client admin", async () => {
    roleInDatabase({ role: "super_admin" });

    await expect(assertSuperAdmin(session(adminId))).resolves.toHaveProperty("from");
    expect(db.from).toHaveBeenCalledWith("user_roles");
    expect(db.filters).toEqual(
      expect.arrayContaining([
        ["user_id", adminId],
        ["role", "super_admin"],
      ]),
    );
  });

  it("exibe o acesso Master com role vigente mesmo que a sessão informe aal1", async () => {
    roleInDatabase({ role: "super_admin" });

    await expect(getSuperAdminStatus(session(adminId, { aal: "aal1" }))).resolves.toEqual({
      isMaster: true,
      hasMaster: true,
    });
  });

  it("nega o acesso Master quando a sessão não possui role vigente", async () => {
    roleInDatabase(null);

    await expect(getSuperAdminStatus(session(adminId, { aal: "aal2" }))).resolves.toEqual({
      isMaster: false,
      hasMaster: true,
    });
    expect(db.from).toHaveBeenCalledWith("user_roles");
  });

  it("nega quando a role foi revogada", async () => {
    roleInDatabase(null);

    await expect(assertSuperAdmin(session(adminId))).rejects.toThrow(
      "Acesso restrito ao painel master.",
    );
  });

  it("consulta a role em toda chamada e bloqueia imediatamente após revogação", async () => {
    roleInDatabase({ role: "super_admin" });
    await expect(assertSuperAdmin(session(adminId))).resolves.toBeDefined();

    roleInDatabase(null);
    await expect(assertSuperAdmin(session(adminId))).rejects.toThrow(
      "Acesso restrito ao painel master.",
    );
    expect(db.from).toHaveBeenCalledTimes(2);
  });

  it("permite duas contas de administrador independentes na mesma instalação", async () => {
    roleInDatabase({ role: "super_admin" });
    const secondAdminId = "44444444-4444-4444-8444-444444444444";

    await expect(assertSuperAdmin(session(adminId))).resolves.toBeDefined();
    await expect(assertSuperAdmin(session(secondAdminId))).resolves.toBeDefined();
    expect(db.filters).toContainEqual(["user_id", adminId]);
    expect(db.filters).toContainEqual(["user_id", secondAdminId]);
  });

  it("nega a donos comuns de negócios diferentes", async () => {
    roleInDatabase(null);

    await expect(assertSuperAdmin(session(ownerId))).rejects.toThrow(
      "Acesso restrito ao painel master.",
    );
    await expect(assertSuperAdmin(session("33333333-3333-4333-8333-333333333333"))).rejects.toThrow(
      "Acesso restrito ao painel master.",
    );
    expect(db.from).toHaveBeenCalledTimes(2);
  });

  it("não aceita role declarada em claims ou metadados do JWT sem linha no banco", async () => {
    roleInDatabase(null);
    const forged = session(ownerId, {
      app_metadata: { role: "super_admin", roles: ["super_admin"] },
      user_metadata: { role: "super_admin" },
    });

    await expect(assertSuperAdmin(forged)).rejects.toThrow("Acesso restrito ao painel master.");
  });

  it("falha fechada quando a consulta da role retorna erro", async () => {
    roleInDatabase(null, { message: "banco indisponível" });

    await expect(assertSuperAdmin(session(adminId))).rejects.toThrow("banco indisponível");
  });
});
