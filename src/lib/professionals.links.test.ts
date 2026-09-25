import { beforeEach, describe, expect, it, vi } from "vitest";

// T014 (spec 002): troca de vínculos em service_professionals feita por saveProfessional.
// saveProfessional escreve com service role, que ignora a RLS
// "service_professionals_owner_manage" (mesmo negócio para serviço e profissional).
// Por isso a integridade e o isolamento por business_id precisam vir da função.

type Row = Record<string, unknown>;
type Op = "select" | "insert" | "update" | "delete";
type Failure = { table: string; op: Op; message: string };

const state = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  failures: [] as { table: string; op: string; message: string }[],
  writes: [] as { table: string; op: string }[],
}));

function failOnce(failure: Failure) {
  state.failures.push(failure);
}

class FakeQuery {
  private op: Op = "select";
  private payload: Row | Row[] | null = null;
  private filters: [string, unknown][] = [];
  private inFilters: [string, unknown[]][] = [];
  private mode: "many" | "single" | "maybe" = "many";

  constructor(private table: string) {}

  select() {
    return this;
  }
  insert(payload: Row | Row[]) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Row) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  upsert(payload: Row) {
    return this.insert(payload);
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.inFilters.push([column, values]);
    return this;
  }
  single() {
    this.mode = "single";
    return this.exec();
  }
  maybeSingle() {
    this.mode = "maybe";
    return this.exec();
  }
  then<T>(resolve: (v: { data: unknown; error: unknown }) => T, reject?: (e: unknown) => T) {
    return this.exec().then(resolve, reject);
  }

  private matches(row: Row) {
    return (
      this.filters.every(([c, v]) => row[c] === v) &&
      this.inFilters.every(([c, values]) => values.includes(row[c]))
    );
  }

  private async exec(): Promise<{ data: unknown; error: { message: string } | null }> {
    const rows = (state.tables[this.table] ??= []);
    const failureIndex = state.failures.findIndex(
      (f) => f.table === this.table && f.op === this.op,
    );
    if (failureIndex >= 0) {
      const [failure] = state.failures.splice(failureIndex, 1);
      return { data: null, error: { message: failure?.message ?? "falha" } };
    }
    if (this.op !== "select") state.writes.push({ table: this.table, op: this.op });

    let result: Row[];
    if (this.op === "insert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload!];
      result = list.map((r) => ({ id: r["id"] ?? crypto.randomUUID(), ...r }));
      rows.push(...result);
    } else if (this.op === "update") {
      result = rows.filter((r) => this.matches(r));
      result.forEach((r) => Object.assign(r, this.payload));
    } else if (this.op === "delete") {
      result = rows.filter((r) => this.matches(r));
      state.tables[this.table] = rows.filter((r) => !this.matches(r));
    } else {
      result = rows.filter((r) => this.matches(r));
    }

    if (this.mode === "many") return { data: result, error: null };
    if (this.mode === "maybe") return { data: result[0] ?? null, error: null };
    return result.length === 1
      ? { data: result[0], error: null }
      : { data: null, error: { message: "JSON object requested, multiple (or no) rows returned" } };
  }
}

const fakeClient = {
  from: (table: string) => new FakeQuery(table),
  rpc: async (
    _name: string,
    args: { _business_id: string; _professional_id: string; _service_ids: string[] },
  ) => {
    const fail = (op: Op) => {
      const index = state.failures.findIndex(
        (item) => item.table === "service_professionals" && item.op === op,
      );
      return index < 0 ? null : state.failures.splice(index, 1)[0];
    };
    const before = [...(state.tables["service_professionals"] ?? [])];
    const deleteFailure = fail("delete");
    if (deleteFailure) return { error: { message: deleteFailure.message } };
    state.tables["service_professionals"] = before.filter(
      (row) =>
        row["business_id"] !== args._business_id ||
        row["professional_id"] !== args._professional_id,
    );
    const insertFailure = fail("insert");
    if (insertFailure) {
      state.tables["service_professionals"] = before;
      return { error: { message: insertFailure.message } };
    }
    state.tables["service_professionals"].push(
      ...args._service_ids.map((serviceId) =>
        link(args._business_id, args._professional_id, serviceId),
      ),
    );
    return { error: null };
  },
  auth: {
    admin: {
      updateUserById: vi.fn(async () => ({ data: {}, error: null })),
      createUser: vi.fn(async () => ({ data: { user: { id: crypto.randomUUID() } }, error: null })),
    },
  },
};

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
        (arg: { data: unknown; context: unknown }) =>
          fn({ data: validate(arg.data), context: arg.context }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: fakeClient }));

const { saveProfessional } = await import("./professionals.functions");
const save = saveProfessional as unknown as (arg: {
  data: unknown;
  context: unknown;
}) => Promise<{ id: string }>;

const OWNER = "0a000000-0000-4000-8000-000000000001";
const BUSINESS_A = "0b000000-0000-4000-8000-00000000000a";
const BUSINESS_B = "0b000000-0000-4000-8000-00000000000b";
const PRO_A = "0c000000-0000-4000-8000-00000000000a";
const PRO_B = "0c000000-0000-4000-8000-00000000000b";
const SVC_A1 = "0d000000-0000-4000-8000-0000000000a1";
const SVC_A2 = "0d000000-0000-4000-8000-0000000000a2";
const SVC_A3 = "0d000000-0000-4000-8000-0000000000a3";
const SVC_B1 = "0d000000-0000-4000-8000-0000000000b1";

const link = (business_id: string, professional_id: string, service_id: string) => ({
  business_id,
  professional_id,
  service_id,
});

function seed() {
  state.failures = [];
  state.writes = [];
  state.tables = {
    // Dono é dono dos dois negócios, para provar que o isolamento não depende só da posse.
    businesses: [
      { id: BUSINESS_A, owner_id: OWNER },
      { id: BUSINESS_B, owner_id: OWNER },
    ],
    services: [
      { id: SVC_A1, business_id: BUSINESS_A },
      { id: SVC_A2, business_id: BUSINESS_A },
      { id: SVC_A3, business_id: BUSINESS_A },
      { id: SVC_B1, business_id: BUSINESS_B },
    ],
    professionals: [
      { id: PRO_A, business_id: BUSINESS_A, user_id: "user-pro-a", name: "Ana" },
      { id: PRO_B, business_id: BUSINESS_B, user_id: "user-pro-b", name: "Bia" },
    ],
    service_professionals: [
      link(BUSINESS_A, PRO_A, SVC_A1),
      link(BUSINESS_A, PRO_A, SVC_A2),
      link(BUSINESS_B, PRO_B, SVC_B1),
    ],
    user_roles: [],
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    id: PRO_A,
    businessId: BUSINESS_A,
    name: "Ana",
    phone: "11999990000",
    email: "",
    password: "",
    workingDays: [1, 2, 3],
    permissions: {},
    serviceIds: [SVC_A3],
    ...overrides,
  };
}

const run = (data: unknown) => save({ data, context: { supabase: fakeClient, userId: OWNER } });

type Link = ReturnType<typeof link>;
const allLinks = () => (state.tables["service_professionals"] ?? []) as Link[];

const linksOf = (professionalId: string) =>
  allLinks()
    .filter((l) => l.professional_id === professionalId)
    .map((l) => `${l.business_id}:${l.service_id}`)
    .sort();

describe("saveProfessional — troca de vínculos service_professionals", () => {
  beforeEach(seed);

  it("substitui os vínculos quando tudo dá certo", async () => {
    await run(input({ serviceIds: [SVC_A2, SVC_A3] }));
    expect(linksOf(PRO_A)).toEqual([`${BUSINESS_A}:${SVC_A2}`, `${BUSINESS_A}:${SVC_A3}`]);
    expect(linksOf(PRO_B)).toEqual([`${BUSINESS_B}:${SVC_B1}`]);
  });

  it("falha ao inserir os novos vínculos sem apagar os vínculos anteriores", async () => {
    failOnce({ table: "service_professionals", op: "insert", message: "insert falhou" });

    await expect(run(input({ serviceIds: [SVC_A3] }))).rejects.toThrow();

    expect(linksOf(PRO_A)).toEqual([`${BUSINESS_A}:${SVC_A1}`, `${BUSINESS_A}:${SVC_A2}`]);
  });

  it("falha ao apagar os vínculos antigos e não segue gravando novos", async () => {
    failOnce({ table: "service_professionals", op: "delete", message: "delete falhou" });

    await expect(run(input({ serviceIds: [SVC_A3] }))).rejects.toThrow();

    expect(linksOf(PRO_A)).toEqual([`${BUSINESS_A}:${SVC_A1}`, `${BUSINESS_A}:${SVC_A2}`]);
  });
});

describe("saveProfessional — isolamento por business_id", () => {
  beforeEach(seed);

  it("recusa serviceId de outro negócio antes de qualquer escrita", async () => {
    await expect(run(input({ serviceIds: [SVC_A3, SVC_B1] }))).rejects.toThrow();

    expect(state.writes.filter((w) => w.table === "service_professionals")).toEqual([]);
    expect(linksOf(PRO_A)).toEqual([`${BUSINESS_A}:${SVC_A1}`, `${BUSINESS_A}:${SVC_A2}`]);
    expect(allLinks().some((l) => l.service_id === SVC_B1 && l.business_id === BUSINESS_A)).toBe(
      false,
    );
  });

  it("não altera vínculos de profissional de outro negócio informado com businessId errado", async () => {
    await expect(run(input({ id: PRO_B, businessId: BUSINESS_A }))).rejects.toThrow();

    expect(linksOf(PRO_B)).toEqual([`${BUSINESS_B}:${SVC_B1}`]);
  });
});
