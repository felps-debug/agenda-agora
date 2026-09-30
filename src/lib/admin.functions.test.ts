import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// T049 (spec 002, US8): o acesso Master passa a ser login normal por e-mail+senha forte
// com role super_admin; o bootstrap por código fixo e a promoção pública deixam de existir.
// Nenhuma credencial é registrada aqui (nem valor nem derivado do código legado).

const runtime = vi.hoisted(() => ({
  superAdminRow: null as null | { user_id: string },
  businessUpdates: [] as Array<{ patch: Record<string, unknown>; filters: unknown[][] }>,
  diagnosticCharge: null as Record<string, unknown> | null,
  diagnosticEvents: [] as Array<Record<string, unknown>>,
  diagnosticEventFilters: [] as unknown[][],
  // T034/T035 (spec 005, US4): massas de dados das leituras de conciliação financeira.
  tableRows: {} as Record<string, Array<Record<string, unknown>>>,
  deleteError: null as { code: string; message: string } | null,
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (d: unknown) => d;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: (d: unknown) => unknown) => {
        validate = fn;
        return builder;
      },
      handler:
        (fn: (arg: { data: unknown; context: unknown }) => unknown) =>
        (arg: { data?: unknown; context: unknown }) =>
          fn({ data: validate(arg.data), context: arg.context }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => {
  const supabaseAdmin = {
    from: (table: string) => {
      let patch: Record<string, unknown> | null = null;
      let operation: string | null = null;
      const filters: unknown[][] = [];
      const queryOrders: unknown[][] = [];
      const query = {
        select: () => query,
        update: (value: Record<string, unknown>) => {
          patch = value;
          operation = "update";
          return query;
        },
        delete: () => {
          operation = "delete";
          return query;
        },
        eq: (column: string, value: unknown) => {
          filters.push(["eq", column, value]);
          return query;
        },
        lt: (column: string, value: unknown) => {
          filters.push(["lt", column, value]);
          return query;
        },
        in: (column: string, value: unknown) => {
          filters.push(["in", column, value]);
          return query;
        },
        not: (column: string, operator: string, value: unknown) => {
          filters.push(["not", column, operator, value]);
          return query;
        },
        order: (column: string, options: unknown) => {
          queryOrders.push([column, options]);
          return query;
        },
        limit: () => query,
        maybeSingle: async () => ({
          data: table === "deposit_payments" ? runtime.diagnosticCharge : runtime.superAdminRow,
          error: null,
        }),
        then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => {
          if (operation === "delete" && table === "businesses" && runtime.deleteError) {
            return Promise.resolve({ data: null, error: runtime.deleteError }).then(resolve);
          }
          if (table === "businesses" && patch) {
            runtime.businessUpdates.push({ patch, filters: [...filters] });
          }
          if (table === "agpay_webhook_events") {
            runtime.diagnosticEventFilters = [...filters, ...queryOrders];
            return Promise.resolve({ data: runtime.diagnosticEvents, error: null }).then(resolve);
          }
          const rows = (runtime.tableRows[table] ?? null)?.filter((row) =>
            filters.every(([op, column, value]) => {
              if (op === "eq") return row[column as string] === value;
              if (op === "in") return (value as unknown[]).includes(row[column as string]);
              if (op === "lt")
                return Date.parse(String(row[column as string])) < Date.parse(String(value));
              return true;
            }),
          );
          return Promise.resolve({ data: rows ?? null, error: null }).then(resolve);
        },
      };
      return query;
    },
  };
  return { supabaseAdmin };
});

const adminFunctions = await import("./admin.functions");

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), "utf8");
const rel = (file: string) => relative(ROOT, file).replaceAll("\\", "/");

// Arquivos do fluxo de autenticação/Master onde um literal fixo seria credencial.
const AUTH_FILES = [
  ["lib", "admin.functions.ts"],
  ["lib", "auth", "require-super-admin.ts"],
  ["routes", "auth.tsx"],
  ["routes", "_authenticated", "master.tsx"],
];

describe("remoção do bootstrap Master por código fixo", () => {
  it("admin.functions não exporta masterLogin nem claimMaster", () => {
    const exported = Object.keys(adminFunctions);
    expect(exported).not.toContain("masterLogin");
    expect(exported).not.toContain("claimMaster");
  });

  it("nenhum arquivo de src/ usa os identificadores do fluxo legado", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) =>
        /\b(masterLogin|claimMaster|MASTER_CODE|masterCode)\b/.test(readFileSync(file, "utf8")),
      )
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("arquivos de autenticação não contêm literal numérico fixo de 8 dígitos", () => {
    // Busca delimitada: só aponta o arquivo, sem registrar o valor encontrado.
    const offenders = AUTH_FILES.map((parts) => join(SRC, ...parts))
      .filter((file) => {
        try {
          return /["'`]\d{8}["'`]/.test(readFileSync(file, "utf8"));
        } catch {
          return false;
        }
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("servidor não cria nem redefine conta Master com senha própria", () => {
    const source = read("lib", "admin.functions.ts");
    expect(source).not.toMatch(/master_access/);
    expect(source).not.toMatch(/auth\/v1\/token\?grant_type=password/);
  });
});

describe("login do administrador pelo fluxo normal do Supabase", () => {
  it("/auth autentica com signInWithPassword usando endereço de e-mail", () => {
    const source = read("routes", "auth.tsx");
    expect(source).toMatch(/signInWithPassword\(/);
    expect(source).toMatch(/resolveLoginCredentials/);
  });

  it("/auth não depende de função de servidor para abrir sessão Master", () => {
    const source = read("routes", "auth.tsx");
    expect(source).not.toMatch(/useServerFn/);
    expect(source).not.toMatch(/setSession\(/);
  });
});

describe("status Master preservado para a sessão normal", () => {
  const getMasterStatus = adminFunctions.getMasterStatus as unknown as (arg: {
    context: unknown;
  }) => Promise<{ isMaster: boolean }>;

  it("getMasterStatus reconhece a role super_admin da conta autenticada", async () => {
    runtime.superAdminRow = { user_id: "admin-1" };
    await expect(getMasterStatus({ context: { userId: "admin-1" } })).resolves.toMatchObject({
      isMaster: true,
    });
  });

  it("getMasterStatus nega conta sem a role", async () => {
    runtime.superAdminRow = null;
    await expect(getMasterStatus({ context: { userId: "dono-1" } })).resolves.toMatchObject({
      isMaster: false,
    });
  });

  it("mantém o acesso Master quando o admin autenticou apenas com e-mail e senha", async () => {
    runtime.superAdminRow = { user_id: "admin-1" };
    await expect(
      getMasterStatus({ context: { userId: "admin-1", claims: { aal: "aal1" } } }),
    ).resolves.toMatchObject({ isMaster: true });
  });

  it("mostra a navegação de Master somente para quem passa por getMasterStatus", () => {
    const source = read("routes", "_authenticated", "painel.tsx");
    expect(source).toMatch(/masterStatus\?\.isMaster &&/);
    expect(source).toMatch(/to="\/painel\/master"/);
  });

  it("protege a URL Master com guarda de servidor e redireciona a rota legada", () => {
    const panelMaster = read("routes", "_authenticated", "painel.master.tsx");
    const legacyMaster = read("routes", "_authenticated", "master.tsx");
    expect(panelMaster).toMatch(/loader:.*requireMasterAccess\(\)/s);
    expect(legacyMaster).toMatch(/redirect\(\{ to: "\/painel\/master" \}\)/);
  });
});

describe("configuração do split AgPay", () => {
  const setBusinessAgpaySplit = adminFunctions.setBusinessAgpaySplit as unknown as (arg: {
    data: { businessId: string; splitEmail: string; commissionPercent: number };
    context: unknown;
  }) => Promise<{ ok: boolean }>;
  const setAgpaySplitStatus = adminFunctions.setAgpaySplitStatus as unknown as (arg: {
    data: { businessId: string; status: "pendente" | "aprovada" | "bloqueada" };
    context: unknown;
  }) => Promise<{ ok: boolean }>;

  beforeEach(() => {
    runtime.superAdminRow = { user_id: "admin-1" };
    runtime.businessUpdates = [];
  });

  it("rejeita e-mail inválido", async () => {
    await expect(
      Promise.resolve().then(() =>
        setBusinessAgpaySplit({
          data: {
            businessId: "11111111-1111-4111-8111-111111111111",
            splitEmail: "nao-e-email",
            commissionPercent: 3,
          },
          context: { userId: "admin-1" },
        }),
      ),
    ).rejects.toThrow();
    expect(runtime.businessUpdates).toEqual([]);
  });

  it.each([-0.01, 100, 100.01])(
    "rejeita comissão fora de [0, 100): %s",
    async (commissionPercent) => {
      await expect(
        Promise.resolve().then(() =>
          setBusinessAgpaySplit({
            data: {
              businessId: "11111111-1111-4111-8111-111111111111",
              splitEmail: "conta@example.com",
              commissionPercent,
            },
            context: { userId: "admin-1" },
          }),
        ),
      ).rejects.toThrow();
      expect(runtime.businessUpdates).toEqual([]);
    },
  );

  it("salva e-mail e comissão quando chamado por super admin", async () => {
    const data = {
      businessId: "11111111-1111-4111-8111-111111111111",
      splitEmail: "conta@example.com",
      commissionPercent: 3.5,
    };

    await expect(setBusinessAgpaySplit({ data, context: { userId: "admin-1" } })).resolves.toEqual({
      ok: true,
    });
    expect(runtime.businessUpdates).toEqual([
      {
        patch: {
          agpay_split_email: data.splitEmail,
          agpay_commission_percent: data.commissionPercent,
        },
        filters: [["eq", "id", data.businessId]],
      },
    ]);
  });

  it("nega acesso de dono comum à função Master sem role", async () => {
    runtime.superAdminRow = null;
    const data = {
      businessId: "11111111-1111-4111-8111-111111111111",
      splitEmail: "conta@example.com",
      commissionPercent: 3,
    };

    await expect(
      setBusinessAgpaySplit({
        data,
        context: { userId: "dono-1" },
      }),
    ).rejects.toThrow("Acesso restrito ao painel master.");
    expect(runtime.businessUpdates).toEqual([]);
  });

  it("salva status permitido somente quando o e-mail do split está configurado", async () => {
    await expect(
      setAgpaySplitStatus({
        data: {
          businessId: "11111111-1111-4111-8111-111111111111",
          status: "aprovada",
        },
        context: { userId: "admin-1" },
      }),
    ).resolves.toEqual({ ok: true });
    expect(runtime.businessUpdates).toEqual([
      {
        patch: { agpay_split_status: "aprovada" },
        filters: [
          ["eq", "id", "11111111-1111-4111-8111-111111111111"],
          ["not", "agpay_split_email", "is", null],
        ],
      },
    ]);
  });

  it("recusa estado externo incompatível para o split", async () => {
    await expect(
      Promise.resolve().then(() =>
        (
          setAgpaySplitStatus as unknown as (arg: {
            data: { businessId: string; status: string };
            context: unknown;
          }) => Promise<unknown>
        )({
          data: {
            businessId: "11111111-1111-4111-8111-111111111111",
            status: "em_analise",
          },
          context: { userId: "admin-1" },
        }),
      ),
    ).rejects.toThrow();
    expect(runtime.businessUpdates).toEqual([]);
  });
});

describe("diagnóstico de cobrança AgPay", () => {
  const getDepositPaymentDiagnostics =
    adminFunctions.getDepositPaymentDiagnostics as unknown as (arg: {
      data: { chargeId: string };
      context: unknown;
    }) => Promise<{
      charge: Record<string, unknown>;
      events: Array<Record<string, unknown>>;
    }>;

  beforeEach(() => {
    runtime.superAdminRow = { user_id: "admin-1" };
    runtime.diagnosticCharge = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "pendente",
      provider_status: "waiting_payment",
      provider_payment_id: "transaction-uuid-1",
      amount_cents: 5000,
      business_id: "22222222-2222-4222-8222-222222222222",
      created_at: "2026-09-26T12:00:00.000Z",
      paid_at: null,
    };
    runtime.diagnosticEvents = [
      {
        id: "event-1",
        dedupe_hash: "sha256-hash",
        event_type: "deposit.completed",
        transaction_uuid: "transaction-uuid-1",
        status: "failed",
        last_error: "temporary database failure",
        received_at: "2026-09-26T12:01:00.000Z",
      },
    ];
    runtime.diagnosticEventFilters = [];
  });

  it("retorna a cobrança e eventos pelo transaction_uuid, inclusive last_error", async () => {
    await expect(
      getDepositPaymentDiagnostics({
        data: { chargeId: "11111111-1111-4111-8111-111111111111" },
        context: { userId: "admin-1" },
      }),
    ).resolves.toEqual({
      charge: runtime.diagnosticCharge,
      events: runtime.diagnosticEvents,
    });
    expect(runtime.diagnosticEventFilters).toEqual([
      ["eq", "transaction_uuid", "transaction-uuid-1"],
      ["received_at", { ascending: false }],
    ]);
    expect(runtime.diagnosticEvents[0]?.["last_error"]).toBe("temporary database failure");
  });
});

describe("conciliação financeira agregada", () => {
  const getLedgerReconciliation = adminFunctions.getLedgerReconciliation as unknown as (arg: {
    context: unknown;
  }) => Promise<{
    availableCents: number;
    pendingCents: number;
    lockedCents: number;
    platformRevenueCents: number;
  }>;
  const listStuckWithdrawals = adminFunctions.listStuckWithdrawals as unknown as (arg: {
    context: unknown;
  }) => Promise<Array<{ id: string; business_id: string; amount_cents: number }>>;
  const listNegativeBalanceBusinesses =
    adminFunctions.listNegativeBalanceBusinesses as unknown as (arg: {
      context: unknown;
    }) => Promise<Array<{ id: string; name: string; available_cents: number }>>;
  const deleteBusiness = adminFunctions.deleteBusiness as unknown as (arg: {
    data: { id: string };
    context: unknown;
  }) => Promise<{ ok: boolean }>;

  const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
  const BUSINESS_ID_2 = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    runtime.superAdminRow = { user_id: "admin-1" };
    runtime.tableRows = {};
    runtime.deleteError = null;
  });

  it("soma available/pending/locked de todos os estabelecimentos", async () => {
    runtime.tableRows = {
      wallets: [
        {
          business_id: BUSINESS_ID,
          available_cents: 10_000,
          pending_cents: 0,
          locked_cents: 2_500,
        },
        {
          business_id: BUSINESS_ID_2,
          available_cents: 3_500,
          pending_cents: 500,
          locked_cents: 1_000,
        },
      ],
      deposit_payments: [],
    };

    await expect(getLedgerReconciliation({ context: { userId: "admin-1" } })).resolves.toEqual({
      availableCents: 13_500,
      pendingCents: 500,
      lockedCents: 3_500,
      platformRevenueCents: 0,
    });
  });

  it("receita da plataforma soma a comissão apenas dos pagamentos pagos", async () => {
    runtime.tableRows = {
      wallets: [
        { business_id: BUSINESS_ID, available_cents: -1_200, pending_cents: 0, locked_cents: 0 },
      ],
      deposit_payments: [
        // Pago por status ou por paid_at preenchido contam; pendente sem paid_at não.
        { status: "pago", paid_at: "2026-09-20T12:00:00.000Z", platform_commission_cents: 1_000 },
        { status: "paid", paid_at: null, platform_commission_cents: 250 },
        { status: "pendente", paid_at: "2026-09-21T12:00:00.000Z", platform_commission_cents: 400 },
        { status: "pendente", paid_at: null, platform_commission_cents: 900 },
        { status: "pendente", paid_at: null, platform_commission_cents: null },
      ],
    };

    const totals = await getLedgerReconciliation({ context: { userId: "admin-1" } });
    expect(totals.availableCents).toBe(-1_200);
    expect(totals.platformRevenueCents).toBe(1_650);
  });

  it("lista saques presos acima de 24h e esconde os recentes", async () => {
    const now = Date.now();
    runtime.tableRows = {
      withdrawals: [
        {
          id: "saque-25h",
          business_id: BUSINESS_ID,
          amount_cents: 5_000,
          status: "processing",
          updated_at: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "saque-10h",
          business_id: BUSINESS_ID,
          amount_cents: 7_000,
          status: "processing",
          updated_at: new Date(now - 10 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "saque-antigo-pago",
          business_id: BUSINESS_ID,
          amount_cents: 9_000,
          status: "paid",
          updated_at: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
        },
      ],
    };

    const stuck = await listStuckWithdrawals({ context: { userId: "admin-1" } });
    expect(stuck.map((row) => row.id)).toEqual(["saque-25h"]);
    expect(stuck[0]?.amount_cents).toBe(5_000);
  });

  it("lista apenas negócios com saldo disponível negativo", async () => {
    runtime.tableRows = {
      wallets: [
        { business_id: BUSINESS_ID, available_cents: -2_000 },
        { business_id: BUSINESS_ID_2, available_cents: 1_000 },
      ],
      businesses: [
        { id: BUSINESS_ID, name: "Bar do Zé" },
        { id: BUSINESS_ID_2, name: "Salão da Ana" },
      ],
    };

    await expect(
      listNegativeBalanceBusinesses({ context: { userId: "admin-1" } }),
    ).resolves.toEqual([{ id: BUSINESS_ID, name: "Bar do Zé", available_cents: -2_000 }]);
  });

  it("recusa exclusão com histórico financeiro em vez do erro cru do Postgres", async () => {
    runtime.deleteError = {
      code: "23503",
      message:
        'update or delete on table "businesses" violates foreign key constraint "ledger_entries_business_id_fkey" on table "ledger_entries"',
    };

    await expect(
      deleteBusiness({ data: { id: BUSINESS_ID }, context: { userId: "admin-1" } }),
    ).rejects.toThrow("Este negócio tem histórico financeiro e não pode ser excluído.");
  });

  it("propaga outras violações de FK sem mascará-las", async () => {
    runtime.deleteError = {
      code: "23503",
      message: 'violates foreign key constraint "appointment_services_business_id_fkey"',
    };

    await expect(
      deleteBusiness({ data: { id: BUSINESS_ID }, context: { userId: "admin-1" } }),
    ).rejects.toThrow(/appointment_services_business_id_fkey/);
  });

  it("nega a conciliação para dono sem role super_admin", async () => {
    runtime.superAdminRow = null;
    runtime.tableRows = { wallets: [], deposit_payments: [] };

    await expect(getLedgerReconciliation({ context: { userId: "dono-1" } })).rejects.toThrow(
      "Acesso restrito ao painel master.",
    );
    await expect(listStuckWithdrawals({ context: { userId: "dono-1" } })).rejects.toThrow(
      "Acesso restrito ao painel master.",
    );
  });
});
