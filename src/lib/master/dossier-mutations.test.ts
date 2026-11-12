import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdmin, serverFnMock } from "@/test-support/fake-admin";

const BUSINESS = "7b1b0e0e-5b7a-4c1f-8a53-0e9d2f6c1a11";
const runtime = vi.hoisted(() => ({
  fake: null as ReturnType<typeof import("@/test-support/fake-admin").createFakeAdmin> | null,
  allowed: true,
  authUpdate: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/auth/require-super-admin", () => ({
  assertSuperAdmin: async () => {
    if (!runtime.allowed) throw Error("Acesso restrito ao painel master.");
    return {
      from: runtime.fake!.client.from,
      auth: {
        admin: {
          updateUserById: runtime.authUpdate,
          getUserById: async () => ({ data: { user: { email: "old@agenda.local" } }, error: null }),
        },
      },
    };
  },
}));
const { updateBusinessContact } = await import("./dossier.functions");
const { setOwnerPassword } = await import("../reset-password.functions");
type Call = (input: { data: unknown; context: { userId: string } }) => Promise<unknown>;
const contact = updateBusinessContact as unknown as Call;
const password = setOwnerPassword as unknown as Call;
const context = { userId: "master" };
beforeEach(() => {
  runtime.allowed = true;
  runtime.authUpdate.mockReset().mockResolvedValue({ error: null });
  runtime.fake = createFakeAdmin({
    businesses: [{ id: BUSINESS, owner_id: "owner", phone: "11900000000", name: "Teste" }],
    profiles: [{ id: "owner", email: "old@agenda.local", full_name: "Original" }],
  });
});

describe("dossier login and contact changes", () => {
  it("requires master before any write", async () => {
    runtime.allowed = false;
    await expect(
      contact({ data: { businessId: BUSINESS, field: "name", value: "New" }, context }),
    ).rejects.toThrow(/master/);
    await expect(
      password({ data: { businessId: BUSINESS, password: "4821" }, context }),
    ).rejects.toThrow(/master/);
    expect(runtime.fake!.calls.inserts).toHaveLength(0);
    expect(runtime.authUpdate).not.toHaveBeenCalled();
  });
  it.each(["", "123", "12345", "Senha123", "12a4"])(
    "rejects anything that is not a 4-digit PIN (%j) before Auth",
    async (value) => {
      await expect(
        password({ data: { businessId: BUSINESS, password: value }, context }),
      ).rejects.toThrow();
      expect(runtime.authUpdate).not.toHaveBeenCalled();
    },
  );
  it("fails closed if audit cannot be written", async () => {
    runtime.fake!.failures["master_business_events:insert"] = { message: "offline" };
    await expect(
      password({ data: { businessId: BUSINESS, password: "4821" }, context }),
    ).rejects.toThrow(/auditoria/);
    expect(runtime.authUpdate).not.toHaveBeenCalled();
  });
  it("stores the PIN with the login prefix and never includes it in audit", async () => {
    await password({ data: { businessId: BUSINESS, password: "4821" }, context });
    // O login por telefone envia `agendaagora:<PIN>`; o Auth precisa guardar igual.
    expect(runtime.authUpdate).toHaveBeenCalledWith("owner", { password: "agendaagora:4821" });
    const events = runtime.fake!.tables["master_business_events"]!;
    expect(events[0]).toMatchObject({
      actor_id: "master",
      type: "troca_senha_dono",
      title: "Senha do dono alterada pelo Master",
    });
    expect(JSON.stringify(events)).not.toContain("4821");
  });
  it("updates name and responsible person in their authoritative records", async () => {
    await contact({ data: { businessId: BUSINESS, field: "name", value: "Novo nome" }, context });
    await contact({
      data: { businessId: BUSINESS, field: "responsavel", value: "Responsável" },
      context,
    });
    expect(runtime.fake!.tables["businesses"]![0]!["name"]).toBe("Novo nome");
    expect(runtime.fake!.tables["profiles"]![0]!["full_name"]).toBe("Responsável");
  });
  it("updates the phone login in Auth, profile and business", async () => {
    await contact({
      data: { businessId: BUSINESS, field: "phone", value: "(11) 91111-2222" },
      context,
    });
    expect(runtime.authUpdate).toHaveBeenCalledWith("owner", {
      email: "11911112222@agenda.local",
      email_confirm: true,
    });
    expect(runtime.fake!.tables["profiles"]![0]!["email"]).toBe("11911112222@agenda.local");
    expect(runtime.fake!.tables["businesses"]![0]!["phone"]).toBe("11911112222");
  });
  it("restores the original login if the business update fails", async () => {
    runtime.fake!.failures["businesses:update"] = { message: "offline" };
    await expect(
      contact({ data: { businessId: BUSINESS, field: "phone", value: "11911112222" }, context }),
    ).rejects.toThrow(/preservado/);
    expect(runtime.authUpdate).toHaveBeenLastCalledWith("owner", {
      email: "old@agenda.local",
      email_confirm: true,
    });
    expect(runtime.fake!.tables["profiles"]![0]!["email"]).toBe("old@agenda.local");
    expect(runtime.fake!.tables["businesses"]![0]!["phone"]).toBe("11900000000");
  });
});
