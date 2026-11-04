/**
 * Fake mínimo e em memória do cliente `supabaseAdmin`, só para testes unitários.
 * Cobre o subconjunto de consultas usado pelas funções de servidor da Spec 010.
 */
export type Row = Record<string, unknown>;
type DbError = { code?: string; message: string };

type Operation = "select" | "insert" | "update" | "upsert" | "delete";

export function createFakeAdmin(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(seed)) tables[name] = rows.map((row) => ({ ...row }));
  let idCounter = 0;

  const calls = {
    inserts: [] as Array<{ table: string; row: Row }>,
    updates: [] as Array<{ table: string; patch: Row; filters: string[] }>,
    upserts: [] as Array<{ table: string; row: Row }>,
    deletes: [] as Array<{ table: string; filters: string[] }>,
    authCreates: [] as Array<{ email: string; password: string }>,
    authUpdates: [] as Array<{ id: string; attrs: Record<string, unknown> }>,
  };
  /** Erros forçados por `${tabela}:${operação}`. */
  const failures: Record<string, DbError> = {};
  const authUsers = new Map<string, string>();
  let authCreateFailure: DbError | null = null;

  function from(table: string) {
    let op: Operation = "select";
    let payload: Row | Row[] = {};
    const predicates: Array<(row: Row) => boolean> = [];
    const filterLabels: string[] = [];
    let limitN: number | undefined;

    function run(): { data: Row[]; error: DbError | null; count?: number } {
      const forced = failures[`${table}:${op}`];
      if (forced) return { data: [], error: forced };
      const rows = (tables[table] ??= []);
      const matches = () => rows.filter((row) => predicates.every((predicate) => predicate(row)));
      if (op === "insert") {
        const batch = (Array.isArray(payload) ? payload : [payload]) as Row[];
        const inserted = batch.map((value) => {
          const row: Row = {
            id: `${table}-${++idCounter}`,
            created_at: new Date().toISOString(),
            ...value,
          };
          rows.push(row);
          calls.inserts.push({ table, row: { ...row } });
          return row;
        });
        return { data: inserted, error: null };
      }
      if (op === "upsert") {
        const row: Row = { id: `${table}-${++idCounter}`, ...(payload as Row) };
        rows.push(row);
        calls.upserts.push({ table, row: { ...row } });
        return { data: [row], error: null };
      }
      if (op === "update") {
        const targets = matches();
        for (const row of targets) Object.assign(row, payload as Row);
        calls.updates.push({ table, patch: { ...(payload as Row) }, filters: [...filterLabels] });
        return { data: targets, error: null };
      }
      if (op === "delete") {
        const targets = matches();
        tables[table] = rows.filter((row) => !targets.includes(row));
        calls.deletes.push({ table, filters: [...filterLabels] });
        return { data: targets, error: null, count: targets.length };
      }
      const found = matches();
      return { data: limitN === undefined ? found : found.slice(0, limitN), error: null };
    }

    const query = {
      select: () => query,
      insert: (value: Row | Row[]) => {
        op = "insert";
        payload = value;
        return query;
      },
      upsert: (value: Row) => {
        op = "upsert";
        payload = value;
        return query;
      },
      update: (value: Row) => {
        op = "update";
        payload = value;
        return query;
      },
      delete: (_options?: { count?: string }) => {
        op = "delete";
        return query;
      },
      eq: (column: string, value: unknown) => {
        predicates.push((row) => row[column] === value);
        filterLabels.push(`${column}=${String(value)}`);
        return query;
      },
      in: (column: string, values: unknown[]) => {
        predicates.push((row) => values.includes(row[column]));
        filterLabels.push(`${column} in`);
        return query;
      },
      gte: (column: string, value: unknown) => {
        predicates.push((row) => Date.parse(String(row[column])) >= Date.parse(String(value)));
        filterLabels.push(`${column}>=`);
        return query;
      },
      lte: (column: string, value: unknown) => {
        predicates.push((row) => Date.parse(String(row[column])) <= Date.parse(String(value)));
        filterLabels.push(`${column}<=`);
        return query;
      },
      lt: (column: string, value: unknown) => {
        predicates.push((row) => Date.parse(String(row[column])) < Date.parse(String(value)));
        filterLabels.push(`${column}<`);
        return query;
      },
      order: () => query,
      limit: (n: number) => {
        limitN = n;
        return query;
      },
      maybeSingle: async () => {
        const { data, error } = run();
        return { data: data[0] ?? null, error };
      },
      single: async () => {
        const { data, error } = run();
        if (error) return { data: null, error };
        return data[0]
          ? { data: data[0], error: null }
          : { data: null, error: { message: "Row not found" } };
      },
      then: (resolve: (value: { data: Row[]; error: DbError | null; count?: number }) => unknown) =>
        Promise.resolve(run()).then(resolve),
    };
    return query;
  }

  /** Funções SQL simuladas: `rpcHandlers[nome](args)` devolve o `data` da chamada. */
  const rpcHandlers: Record<string, (args: Record<string, unknown>) => unknown> = {};
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const handler = rpcHandlers[name];
    if (!handler) return { data: null, error: { message: `rpc ${name} não simulada` } };
    return { data: handler(args), error: null };
  };

  const auth = {
    admin: {
      createUser: async (attrs: { email: string; password: string }) => {
        calls.authCreates.push({ email: attrs.email, password: attrs.password });
        if (authCreateFailure) return { data: { user: null }, error: authCreateFailure };
        if (authUsers.has(attrs.email)) {
          return {
            data: { user: null },
            error: {
              code: "email_exists",
              message: "A user with this email address has already been registered",
            },
          };
        }
        const id = `user-${authUsers.size + 1}`;
        authUsers.set(attrs.email, id);
        return { data: { user: { id } }, error: null };
      },
      updateUserById: async (id: string, attrs: Record<string, unknown>) => {
        calls.authUpdates.push({ id, attrs });
        return { data: { user: { id } }, error: null };
      },
    },
  };

  return {
    client: { from, auth, rpc },
    rpcHandlers,
    tables,
    calls,
    failures,
    failAuthCreate: (error: DbError | null) => {
      authCreateFailure = error;
    },
    seedAuthUser: (email: string, id: string) => authUsers.set(email, id),
  };
}

/** Executa o handler direto, sem o wrapper de rede do TanStack Start. */
export function serverFnMock() {
  return {
    createServerFn: () => {
      let validate = (value: unknown) => value;
      const builder = {
        middleware: () => builder,
        inputValidator: (fn: (value: unknown) => unknown) => {
          validate = fn;
          return builder;
        },
        handler:
          (fn: (arg: { data: unknown; context: unknown }) => unknown) =>
          async (arg: { data?: unknown; context?: unknown }) =>
            fn({ data: validate(arg.data), context: arg.context }),
      };
      return builder;
    },
  };
}
