import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  roleError: null as Error | null,
  businessError: null as Error | null,
  businessLookupError: null as Error | null,
  existingOwnerBusiness: false,
  businessInsertCalls: 0,
  deletedUsers: [] as string[],
  deletedRoles: [] as string[],
  admin: null as unknown,
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler:
        (fn: (args: { context: unknown; data: unknown }) => unknown) =>
        (args: { context: unknown; data: unknown }) =>
          fn(args),
    };
    return builder;
  },
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/auth/require-super-admin", () => ({
  assertSuperAdmin: async () => runtime.admin,
  getSuperAdminStatus: async () => ({ isMaster: true }),
}));
vi.mock("@/integrations/supabase/client.server", () => {
  const supabaseAdmin = {
    auth: {
      admin: {
        createUser: async () => ({ data: { user: { id: "owner-1" } }, error: null }),
        deleteUser: async (userId: string) => {
          runtime.deletedUsers.push(userId);
          return { data: { user: { id: userId } }, error: null };
        },
      },
    },
    from: (table: string) => {
      let operation: "upsert" | "insert" | "delete" | null = null;
      const query: Record<string, unknown> = {
        upsert: () => {
          operation = "upsert";
          return query;
        },
        insert: () => {
          operation = "insert";
          return query;
        },
        delete: () => {
          operation = "delete";
          return query;
        },
        eq: () => query,
        select: () => query,
        maybeSingle: async () => ({
          data: runtime.existingOwnerBusiness ? { id: "business-1" } : null,
          error: runtime.businessLookupError,
        }),
        single: async () => {
          runtime.businessInsertCalls++;
          return runtime.businessError
            ? { data: null, error: runtime.businessError }
            : { data: { id: "business-1", slug: "studio-1" }, error: null };
        },
        then: (resolve: (result: { data: unknown; error: Error | null }) => unknown) => {
          if (table === "user_roles" && operation === "upsert") {
            return Promise.resolve({ data: null, error: runtime.roleError }).then(resolve);
          }
          if (table === "user_roles" && operation === "delete") {
            runtime.deletedRoles.push("owner-1");
          }
          return Promise.resolve({ data: null, error: null }).then(resolve);
        },
      };
      return query;
    },
  };
  runtime.admin = supabaseAdmin;
  return { supabaseAdmin };
});

await import("@/integrations/supabase/client.server");
const { createBusinessWithOwner } = await import("./admin.functions");

const data = {
  businessName: "Studio Um",
  category: "beleza",
  ownerName: "Pessoa Dona",
  phone: "85999990000",
  password: "senha-segura",
};
const createBusiness = createBusinessWithOwner as unknown as (args: {
  context: unknown;
  data: typeof data;
}) => Promise<unknown>;

describe("createBusinessWithOwner compensations", () => {
  beforeEach(() => {
    runtime.roleError = null;
    runtime.businessError = null;
    runtime.businessLookupError = null;
    runtime.existingOwnerBusiness = false;
    runtime.businessInsertCalls = 0;
    runtime.deletedUsers = [];
    runtime.deletedRoles = [];
  });

  it("removes the newly created Auth user when assigning the owner role fails", async () => {
    runtime.roleError = new Error("role insert failed");

    await expect(createBusiness({ context: { admin: {} }, data })).rejects.toThrow(
      "Could not assign owner access.",
    );

    expect(runtime.deletedUsers).toEqual(["owner-1"]);
    expect(runtime.businessInsertCalls).toBe(0);
  });

  it("removes the owner role and Auth user when business creation fails", async () => {
    runtime.businessError = new Error("business insert failed");

    await expect(createBusiness({ context: { admin: {} }, data })).rejects.toThrow(
      "business insert failed",
    );

    expect(runtime.deletedRoles).toEqual(["owner-1"]);
    expect(runtime.deletedUsers).toEqual(["owner-1"]);
  });

  it("preserves the account when the failed business insert cannot be reconciled", async () => {
    runtime.businessError = new Error("business insert response lost");
    runtime.businessLookupError = new Error("lookup failed");

    await expect(createBusiness({ context: { admin: {} }, data })).rejects.toThrow(
      "needs reconciliation",
    );

    expect(runtime.deletedRoles).toEqual([]);
    expect(runtime.deletedUsers).toEqual([]);
  });
});
