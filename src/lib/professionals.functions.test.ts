import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveProfessional } from "./professionals.functions";

const runtime = vi.hoisted(() => ({
  context: {} as unknown,
  admin: {
    from: vi.fn(),
    auth: { admin: { createUser: vi.fn(), updateUserById: vi.fn() } },
  },
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: runtime.admin }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: (data: unknown) => unknown = (data) => data;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: (data: unknown) => unknown) => {
        validate = fn;
        return builder;
      },
      handler:
        (fn: (args: { context: unknown; data: unknown }) => Promise<unknown>) =>
        async ({ data }: { data: unknown }) =>
          fn({ context: runtime.context, data: validate(data) }),
    };
    return builder;
  },
}));

const businessId = "11111111-1111-4111-8111-111111111111";
const professionalId = "22222222-2222-4222-8222-222222222222";
const existingUserId = "33333333-3333-4333-8333-333333333333";
const newUserId = "44444444-4444-4444-8444-444444444444";
const serviceId = "55555555-5555-4555-8555-555555555555";

function query(row: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(async () => ({ data: [{ id: serviceId }], error: null })),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
    update: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    single: vi.fn(async () => ({ data: row, error: null })),
    delete: vi.fn(() => chain),
    upsert: vi.fn(async () => ({ error: null })),
  };
  return chain;
}

function fixture(userId: string | null, existing = true) {
  const owner = query({ id: businessId, owner_id: "owner-1" });
  const professionalRead = query({ user_id: userId });
  const professionalWrite = query({ id: professionalId });
  const links = query(null);
  const roles = query(null);
  let professionalReads = 0;

  const rpc = vi.fn(async () => ({ error: null }));
  runtime.context = { userId: "owner-1", supabase: { from: vi.fn(() => owner), rpc } };
  runtime.admin.from.mockImplementation((table: string) => {
    if (table === "professionals") {
      return existing && professionalReads++ === 0 ? professionalRead : professionalWrite;
    }
    if (table === "service_professionals") return links;
    if (table === "services") return query(null);
    if (table === "user_roles") return roles;
    throw new Error(`Tabela inesperada no teste: ${table}`);
  });
  runtime.admin.auth.admin.createUser.mockResolvedValue({
    data: { user: { id: newUserId } },
    error: null,
  });
  runtime.admin.auth.admin.updateUserById.mockResolvedValue({ error: null });

  return { professionalRead, professionalWrite, links, roles, rpc };
}

function input(existing = true) {
  return {
    ...(existing ? { id: professionalId } : {}),
    businessId,
    name: "Profissional Teste",
    role: "Barbeiro",
    phone: "11999990000",
    email: "profissional@example.test",
    password: "",
    workingDays: [1, 2, 3, 4, 5],
    permissions: { view_agenda: true },
    serviceIds: [serviceId],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveProfessional: senha e criação de acesso", () => {
  it("edita vínculos e permissões com senha vazia sem trocar a credencial existente", async () => {
    const db = fixture(existingUserId);

    await expect(saveProfessional({ data: input() })).resolves.toEqual({ id: professionalId });

    expect(runtime.admin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(runtime.admin.auth.admin.updateUserById).toHaveBeenCalledWith(
      existingUserId,
      expect.not.objectContaining({ password: expect.anything() }),
    );
    expect(db.professionalWrite.update).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: existingUserId, permissions: { view_agenda: true } }),
    );
    expect(db.rpc).toHaveBeenCalledWith("replace_professional_services", {
      _business_id: businessId,
      _professional_id: professionalId,
      _service_ids: [serviceId],
    });
  });

  it("edita profissional sem user_id e senha vazia sem criar conta Auth", async () => {
    const db = fixture(null);

    await expect(saveProfessional({ data: input() })).resolves.toEqual({ id: professionalId });

    expect(runtime.admin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(db.professionalWrite.update).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: null, permissions: { view_agenda: true } }),
    );
    expect(db.rpc).toHaveBeenCalledOnce();
  });

  it("não cria login só porque um PIN foi enviado sem ação explícita", async () => {
    const db = fixture(null);

    await expect(saveProfessional({ data: { ...input(), password: "1234" } })).resolves.toEqual({
      id: professionalId,
    });

    expect(runtime.admin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(db.professionalWrite.update).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: null }),
    );
  });

  it("cria acesso apenas quando solicitado explicitamente com PIN de quatro dígitos", async () => {
    const db = fixture(null);

    await expect(
      saveProfessional({ data: { ...input(), createAccess: true, password: "0000" } }),
    ).resolves.toEqual({ id: professionalId });

    expect(runtime.admin.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ password: "agendaagora:0000" }),
    );
    expect(db.roles.upsert).toHaveBeenCalledWith(
      { user_id: newUserId, role: "professional" },
      { onConflict: "user_id,role" },
    );
    expect(db.professionalWrite.update).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: newUserId }),
    );
  });

  it("rejeita criação explícita de acesso sem PIN antes de escrever", async () => {
    const db = fixture(null);

    await expect(saveProfessional({ data: { ...input(), createAccess: true } })).rejects.toThrow(
      /quatro dígitos/i,
    );

    expect(runtime.admin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(db.professionalWrite.update).not.toHaveBeenCalled();
  });

  it.each(["123", "12345", "12a4", "-123"])(
    "rejeita PIN inválido %s antes de criar acesso",
    async (password) => {
      const db = fixture(null);

      await expect(
        saveProfessional({ data: { ...input(), createAccess: true, password } }),
      ).rejects.toThrow();

      expect(runtime.admin.auth.admin.createUser).not.toHaveBeenCalled();
      expect(db.professionalWrite.update).not.toHaveBeenCalled();
    },
  );
});
