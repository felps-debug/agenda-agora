import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteProfessional, saveProfessional } from "./professionals.functions";

const runtime = vi.hoisted(() => ({
  context: {} as unknown,
  admin: {
    from: vi.fn(),
    auth: { admin: { createUser: vi.fn(), updateUserById: vi.fn(), deleteUser: vi.fn() } },
  },
  professionalCount: 0 as number | null | undefined,
  professionalCountError: null as { message: string } | null,
  roleError: null as { message: string } | null,
  saveError: null as { message: string } | null,
  linkError: null as { message: string } | null,
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

function query(row: unknown, writeError: { message: string } | null = null) {
  let isCountQuery = false;
  const chain = {
    select: vi.fn((_columns?: unknown, options?: { count?: string }) => {
      isCountQuery = options?.count === "exact";
      return chain;
    }),
    eq: vi.fn(() => chain),
    in: vi.fn(async () => ({ data: [{ id: serviceId }], error: null })),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
    update: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    single: vi.fn(async () => ({ data: row, error: writeError })),
    delete: vi.fn(() => chain),
    upsert: vi.fn(async () => ({ error: runtime.roleError })),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(
        isCountQuery
          ? { count: runtime.professionalCount, error: runtime.professionalCountError }
          : { data: row, error: null },
      ).then(resolve),
  };
  return chain;
}

function fixture(userId: string | null, existing = true) {
  const owner = query({ id: businessId, owner_id: "owner-1" });
  const professionalRead = query({ user_id: userId });
  const professionalWrite = query({ id: professionalId }, runtime.saveError);
  const links = query(null);
  const roles = query(null);
  let professionalReads = 0;

  const rpc = vi.fn(async () => ({ error: runtime.linkError }));
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
  runtime.admin.auth.admin.deleteUser.mockResolvedValue({ error: null });

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

const removeProfessional = deleteProfessional as unknown as (arg: {
  data: unknown;
}) => Promise<unknown>;

describe("saveProfessional: limites de arrays de entrada", () => {
  it("rejeita listas de dias maiores que os sete dias da semana", async () => {
    fixture(existingUserId);
    await expect(
      saveProfessional({ data: { ...input(), workingDays: Array(8).fill(1) } }),
    ).rejects.toThrow();
    expect(runtime.admin.from).not.toHaveBeenCalled();
  });

  it("rejeita listas de serviços acima do limite de 1.000 vínculos", async () => {
    fixture(existingUserId);
    await expect(
      saveProfessional({
        data: {
          ...input(),
          serviceIds: Array.from(
            { length: 1001 },
            (_, index) => `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
          ),
        },
      }),
    ).rejects.toThrow();
    expect(runtime.admin.from).not.toHaveBeenCalled();
  });
});

describe("saveProfessional: validação do caminho de avatar", () => {
  it("rejeita um avatar que pertence a outro negócio antes de persistir", async () => {
    fixture(existingUserId);

    await expect(
      saveProfessional({
        data: {
          ...input(),
          avatarPath: "66666666-6666-4666-8666-666666666666/professional/avatar.png",
        },
      }),
    ).rejects.toThrow(/foto.*profissional/i);

    expect(runtime.admin.from).not.toHaveBeenCalled();
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  runtime.professionalCount = 0;
  runtime.professionalCountError = null;
  runtime.roleError = null;
  runtime.saveError = null;
  runtime.linkError = null;
});

describe("saveProfessional: consulta do limite", () => {
  it("falha fechado quando o banco não consegue contar profissionais", async () => {
    fixture(null, false);
    runtime.professionalCountError = { message: "offline" };
    await expect(saveProfessional({ data: input(false) })).rejects.toThrow(/validar.*limite/i);
    expect(runtime.admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("falha fechado quando o banco não retorna a contagem", async () => {
    fixture(null, false);
    runtime.professionalCount = null;
    await expect(saveProfessional({ data: input(false) })).rejects.toThrow(/validar.*limite/i);
    expect(runtime.admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("falha fechado quando a contagem está ausente", async () => {
    fixture(null, false);
    runtime.professionalCount = undefined;
    await expect(saveProfessional({ data: input(false) })).rejects.toThrow(/validar.*limite/i);
    expect(runtime.admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("mantém o limite visível de dez profissionais no servidor", async () => {
    fixture(null, false);
    runtime.professionalCount = 10;
    await expect(saveProfessional({ data: input(false) })).rejects.toThrow(/limite de 10/i);
    expect(runtime.admin.auth.admin.createUser).not.toHaveBeenCalled();
  });
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

describe("saveProfessional provisioning failures", () => {
  it("deletes the created Auth user when the professional role write fails", async () => {
    const f = fixture(null, false);
    runtime.roleError = { message: "role write failed" };

    await expect(
      saveProfessional({ data: { ...input(false), createAccess: true, password: "0000" } }),
    ).rejects.toThrow("role write failed");

    expect(runtime.admin.auth.admin.deleteUser).toHaveBeenCalledWith(newUserId);
    expect(f.professionalWrite.insert).not.toHaveBeenCalled();
  });

  it("compensates the owner role and Auth user when creating the professional row fails", async () => {
    runtime.saveError = { message: "professional insert failed" };
    const fresh = fixture(null, false);

    await expect(
      saveProfessional({ data: { ...input(false), createAccess: true, password: "0000" } }),
    ).rejects.toThrow("professional insert failed");

    expect(fresh.roles.delete).toHaveBeenCalled();
    expect(runtime.admin.auth.admin.deleteUser).toHaveBeenCalledWith(newUserId);
  });
});

describe("deleteProfessional partial cleanup", () => {
  it("reports when the profile was removed but Auth deletion failed", async () => {
    fixture(existingUserId);
    runtime.admin.auth.admin.deleteUser.mockResolvedValue({
      error: { message: "auth deletion failed" },
    });

    await expect(removeProfessional({ data: { id: professionalId, businessId } })).rejects.toThrow(
      "Professional record was removed, but its Auth account could not be deleted.",
    );

    expect(runtime.admin.auth.admin.deleteUser).toHaveBeenCalledWith(existingUserId);
  });

  it("removes newly created profile, role, and Auth when service-link replacement fails", async () => {
    const f = fixture(null, false);
    runtime.linkError = { message: "service links failed" };

    await expect(
      saveProfessional({ data: { ...input(false), createAccess: true, password: "0000" } }),
    ).rejects.toThrow("service links failed");

    expect(f.professionalWrite.delete).toHaveBeenCalled();
    expect(f.roles.delete).toHaveBeenCalled();
    expect(runtime.admin.auth.admin.deleteUser).toHaveBeenCalledWith(newUserId);
  });
});
