import { beforeEach, describe, expect, it, vi } from "vitest";

// T048 (US8). Contrato de `assertSuperAdmin`: recebe o `context` de
// `requireSupabaseAuth` (`{ userId, claims }`) e só libera quando a role
// `super_admin` existe AGORA em `user_roles` (consulta a cada chamada, então
// revogação vale na hora). Role em claims/metadados do JWT não conta.

type RoleRow = { role: string } | null;

const db = vi.hoisted(() => ({
  result: { data: null as RoleRow, error: null as { message: string } | null },
  filters: [] as Array<[string, unknown]>,
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: db.from },
}));

import { assertSuperAdmin } from "./require-super-admin";

type GuardContext = Parameters<typeof assertSuperAdmin>[0];

const adminId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";

function session(userId: string, aal: string | undefined, extraClaims: object = {}) {
  return {
    userId,
    claims: { sub: userId, role: "authenticated", ...(aal ? { aal } : {}), ...extraClaims },
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

describe("assertSuperAdmin: role super_admin atual no banco", () => {
  it("autoriza super_admin e devolve o client admin", async () => {
    roleInDatabase({ role: "super_admin" });

    await expect(assertSuperAdmin(session(adminId, undefined))).resolves.toHaveProperty("from");
    expect(db.from).toHaveBeenCalledWith("user_roles");
    expect(db.filters).toEqual(
      expect.arrayContaining([
        ["user_id", adminId],
        ["role", "super_admin"],
      ]),
    );
  });

  it("nega quando a role foi revogada", async () => {
    roleInDatabase(null);

    await expect(assertSuperAdmin(session(adminId, undefined))).rejects.toThrow(
      "Acesso restrito ao painel master.",
    );
  });

  it("consulta a role a cada chamada: revogação entre duas chamadas bloqueia a segunda", async () => {
    roleInDatabase({ role: "super_admin" });
    await expect(assertSuperAdmin(session(adminId, undefined))).resolves.toBeDefined();

    roleInDatabase(null);
    await expect(assertSuperAdmin(session(adminId, undefined))).rejects.toThrow(
      "Acesso restrito ao painel master.",
    );
    expect(db.from).toHaveBeenCalledTimes(2);
  });

  it("nega dono comum", async () => {
    roleInDatabase(null);

    await expect(assertSuperAdmin(session(ownerId, undefined))).rejects.toThrow(
      "Acesso restrito ao painel master.",
    );
    expect(db.filters).toContainEqual(["user_id", ownerId]);
  });

  it("não aceita role declarada em claims/metadados do JWT sem a linha no banco", async () => {
    roleInDatabase(null);
    const forged = session(ownerId, undefined, {
      app_metadata: { role: "super_admin", roles: ["super_admin"] },
      user_metadata: { role: "super_admin" },
    });

    await expect(assertSuperAdmin(forged)).rejects.toThrow("Acesso restrito ao painel master.");
  });

  it("falha fechada quando a consulta de role dá erro", async () => {
    roleInDatabase(null, { message: "banco indisponível" });

    await expect(assertSuperAdmin(session(adminId, undefined))).rejects.toThrow();
  });
});
