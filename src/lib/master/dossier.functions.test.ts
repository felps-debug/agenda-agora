import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Guarda de acesso da ficha do estabelecimento (Painel 3 Master).
 *
 * O mock de `createServerFn` segue o mesmo padrão de `admin.functions.test.ts`:
 * a função é chamada direto, sem HTTP, e o middleware é ignorado — por isso o
 * guard de role precisa ser garantido dentro do handler (assertSuperAdmin).
 */

const runtime = vi.hoisted(() => ({
  superAdminRow: null as null | { user_id: string },
  tableRows: {} as Record<string, Array<Record<string, unknown>>>,
  inserted: [] as Array<{ table: string; row: Record<string, unknown> }>,
  updated: [] as Array<{ table: string; patch: Record<string, unknown> }>,
  authUser: null as { last_sign_in_at?: string } | null,
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
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: runtime.authUser }, error: null }),
      },
    },
    from: (table: string) => {
      const filters: unknown[][] = [];
      let insertRow: Record<string, unknown> | null = null;
      let patch: Record<string, unknown> | null = null;
      const query = {
        select: () => query,
        insert: (row: Record<string, unknown>) => {
          insertRow = row;
          return query;
        },
        update: (value: Record<string, unknown>) => {
          patch = value;
          return query;
        },
        eq: (column: string, value: unknown) => {
          filters.push(["eq", column, value]);
          return query;
        },
        gte: (column: string, value: unknown) => {
          filters.push(["gte", column, value]);
          return query;
        },
        lte: (column: string, value: unknown) => {
          filters.push(["lte", column, value]);
          return query;
        },
        not: (column: string, operator: string, value: unknown) => {
          filters.push(["not", column, operator, value]);
          return query;
        },
        in: (column: string, value: unknown) => {
          filters.push(["in", column, value]);
          return query;
        },
        order: () => query,
        limit: () => query,
        maybeSingle: async () => {
          if (table === "user_roles") {
            return { data: runtime.superAdminRow, error: null };
          }
          const rows = runtime.tableRows[table] ?? [];
          const matching = rows.filter((row) =>
            filters.every(([op, column, value]) => {
              if (op === "eq") return row[column as string] === value;
              return true;
            }),
          );
          return { data: matching[0] ?? null, error: null };
        },
        then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => {
          if (table === "user_roles") {
            return Promise.resolve({ data: runtime.superAdminRow, error: null }).then(resolve);
          }
          if (insertRow) {
            runtime.inserted.push({ table, row: insertRow });
            return Promise.resolve({ data: insertRow, error: null }).then(resolve);
          }
          if (patch) {
            runtime.updated.push({ table, patch });
            return Promise.resolve({ data: patch, error: null }).then(resolve);
          }
          const rows = runtime.tableRows[table] ?? [];
          const matching = rows.filter((row) =>
            filters.every(([op, column, value]) => {
              if (op === "eq") return row[column as string] === value;
              if (op === "gte")
                return Date.parse(String(row[column as string])) >= Date.parse(String(value));
              if (op === "lte")
                return Date.parse(String(row[column as string])) <= Date.parse(String(value));
              return true;
            }),
          );
          return Promise.resolve({ data: matching, error: null }).then(resolve);
        },
      };
      return query;
    },
  };
  return { supabaseAdmin };
});

const dossierFunctions = await import("./dossier.functions");

const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = "22222222-2222-4222-8222-222222222222";

const getBusinessDossier = dossierFunctions.getBusinessDossier as unknown as (arg: {
  data: { businessId: string; periodDays: number };
  context: unknown;
}) => Promise<{
  usage: { total: number; usageCount: number };
  health: { status: string; score: number | null };
  subscription: { currentStatus: string };
  timeline: Array<{ title: string }>;
}>;

const addBusinessNote = dossierFunctions.addBusinessNote as unknown as (arg: {
  data: { businessId: string; body: string; nextStep?: string };
  context: unknown;
}) => Promise<{ ok: boolean }>;

const updateBusinessCommercial = dossierFunctions.updateBusinessCommercial as unknown as (arg: {
  data: { businessId: string; leadSource?: string };
  context: unknown;
}) => Promise<{ ok: boolean }>;

function iso(daysFromNow: number) {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString();
}

beforeEach(() => {
  runtime.superAdminRow = { user_id: "admin-1" };
  runtime.inserted = [];
  runtime.updated = [];
  runtime.authUser = null;
  runtime.tableRows = {
    businesses: [
      {
        id: BUSINESS_ID,
        name: "Studio Juliana",
        slug: "studio-juliana",
        category: "estetica",
        phone: "11981549276",
        address: null,
        status: "ativo",
        created_at: iso(-120),
        updated_at: iso(-2),
        monthly_fee_cents: 8990,
        owner_id: OWNER_ID,
        trial_days: null,
        trial_created_at: null,
        lead_source: null,
        sales_owner: null,
        commercial_notes: null,
        reminder_enabled: false,
      },
    ],
    profiles: [
      { id: OWNER_ID, full_name: "Guilherme", email: "dono@agenda.local", created_at: iso(-120) },
    ],
    appointments: [
      {
        id: "a1",
        business_id: BUSINESS_ID,
        status: "concluido",
        starts_at: iso(-2),
        created_at: iso(-3),
        service_id: "s1",
        professional_id: "p1",
        customer_id: "c1",
        customer_name: "Ana",
        customer_phone: "11999999999",
      },
    ],
    customers: [
      {
        id: "c1",
        business_id: BUSINESS_ID,
        name: "Ana",
        phone: "11999999999",
        created_at: iso(-40),
      },
    ],
    services: [
      {
        id: "s1",
        business_id: BUSINESS_ID,
        name: "Limpeza de pele",
        price_cents: 12000,
        active: true,
        created_at: iso(-90),
      },
    ],
    professionals: [
      {
        id: "p1",
        business_id: BUSINESS_ID,
        name: "Ana",
        active: true,
        user_id: null,
        created_at: iso(-90),
      },
    ],
    business_hours: [{ id: "h1", business_id: BUSINESS_ID }],
    subscription_payments: [
      {
        business_id: BUSINESS_ID,
        reference_month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`,
        status: "pago",
        amount_cents: 8990,
        paid_at: iso(-5),
        created_at: iso(-5),
      },
    ],
    deposit_payments: [],
    wallets: [{ available_cents: 1000, pending_cents: 0, locked_cents: 0 }],
    pix_key_approvals: [],
    ledger_entries: [],
    business_whatsapp_credentials: [],
    reminder_logs: [],
    master_business_notes: [],
    master_business_events: [],
    business_visual_settings: [],
  };
});

describe("ficha do estabelecimento no Painel 3", () => {
  it("nega o acesso a dono comum sem a role super_admin", async () => {
    runtime.superAdminRow = null;
    await expect(
      getBusinessDossier({
        data: { businessId: BUSINESS_ID, periodDays: 30 },
        context: { userId: "dono-1" },
      }),
    ).rejects.toThrow("Acesso restrito ao painel master.");
  });

  it("monta a ficha com dados reais do banco", async () => {
    const dossier = await getBusinessDossier({
      data: { businessId: BUSINESS_ID, periodDays: 30 },
      context: { userId: "admin-1" },
    });
    expect(dossier.usage.total).toBe(1);
    expect(dossier.usage.usageCount).toBe(1);
    expect(dossier.subscription.currentStatus).toBe("pago");
    expect(
      dossier.timeline.some((event) => event.title.includes("Estabelecimento cadastrado")),
    ).toBe(true);
    expect(dossier.health.score).not.toBeNull();
  });

  it("registra observação interna e o evento de auditoria", async () => {
    await expect(
      addBusinessNote({
        data: { businessId: BUSINESS_ID, body: "Cliente pediu ajuda com o link." },
        context: { userId: "admin-1" },
      }),
    ).resolves.toEqual({ ok: true });
    expect(runtime.inserted.map((entry) => entry.table)).toEqual([
      "master_business_notes",
      "master_business_events",
    ]);
  });

  it("impede que dono comum registre observação interna", async () => {
    runtime.superAdminRow = null;
    await expect(
      addBusinessNote({
        data: { businessId: BUSINESS_ID, body: "tentativa indevida" },
        context: { userId: "dono-1" },
      }),
    ).rejects.toThrow("Acesso restrito ao painel master.");
    expect(runtime.inserted).toEqual([]);
  });

  it("salva os dados comerciais do estabelecimento", async () => {
    await expect(
      updateBusinessCommercial({
        data: { businessId: BUSINESS_ID, leadSource: "Indicação" },
        context: { userId: "admin-1" },
      }),
    ).resolves.toEqual({ ok: true });
    expect(runtime.updated[0]?.patch).toMatchObject({ lead_source: "Indicação" });
  });
});
