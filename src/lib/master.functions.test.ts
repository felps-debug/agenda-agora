import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ role: null as { role: string } | null }));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      handler: (fn: (arg: { context: unknown }) => unknown) => fn,
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: runtime.role, error: null }),
      };
      return query;
    },
  },
}));

import { requireMasterAccess } from "./master.functions";

type Context = { userId: string; claims?: { aal?: string } };

describe("requireMasterAccess na URL /painel/master", () => {
  beforeEach(() => {
    runtime.role = null;
  });

  it("nega dono comum sem role de super admin", async () => {
    await expect(
      (requireMasterAccess as unknown as (arg: { context: Context }) => Promise<unknown>)({
        context: { userId: "owner-a" },
      }),
    ).rejects.toThrow("Acesso restrito ao painel master.");
  });

  it("nega super_admin com role revogada ao acessar a rota", async () => {
    runtime.role = null;
    await expect(
      (requireMasterAccess as unknown as (arg: { context: Context }) => Promise<unknown>)({
        context: { userId: "admin-a", claims: { aal: "aal1" } },
      }),
    ).rejects.toThrow("Acesso restrito ao painel master.");
  });

  it("autoriza a rota por role atual mesmo com sessão aal1", async () => {
    runtime.role = { role: "super_admin" };
    await expect(
      (requireMasterAccess as unknown as (arg: { context: Context }) => Promise<unknown>)({
        context: { userId: "admin-a", claims: { aal: "aal1" } },
      }),
    ).resolves.toEqual({ authorized: true });
  });
});
