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
    ranges: [] as Array<{ table: string; from: number; to: number }>,
    authCreates: [] as Array<{ email: string; password: string }>,
    authUpdates: [] as Array<{ id: string; attrs: Record<string, unknown> }>,
  };
  /** Erros forçados por `${tabela}:${operação}`. */
  const failures: Record<string, DbError> = {};
  /** Sequência de resultados para simular falha seguida de retry bem-sucedido. */
  const failureSequences: Record<string, Array<DbError | null>> = {};
  const authUsers = new Map<string, string>();
  let authCreateFailure: DbError | null = null;

  function from(table: string) {
    let op: Operation = "select";
    let payload: Row | Row[] = {};
    const predicates: Array<(row: Row) => boolean> = [];
    const filterLabels: string[] = [];
    let limitN: number | undefined;
    let rangeBounds: [number, number] | undefined;
    let upsertOptions: { onConflict?: string; ignoreDuplicates?: boolean } | undefined;

    function run(): { data: Row[]; error: DbError | null; count?: number } {
      const key = `${table}:${op}`;
      const sequence = failureSequences[key];
      const forced = sequence?.length ? sequence.shift() : failures[key];
      if (forced) return { data: [], error: forced };
      const rows = (tables[table] ??= []);
      const matches = () => rows.filter((row) => predicates.every((predicate) => predicate(row)));
      if (op === "insert") {
        const batch = (Array.isArray(payload) ? payload : [payload]) as Row[];
        if (table === "whatsapp_incoming_greeting_events") {
          const duplicate = batch.some((candidate) =>
            rows.some((existing) => existing["dedupe_hash"] === candidate["dedupe_hash"]),
          );
          if (duplicate)
            return {
              data: [],
              error: { code: "23505", message: "duplicate key value violates unique constraint" },
            };
        }
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
        const conflictColumns = (upsertOptions?.onConflict ?? "").split(",").filter(Boolean);
        const batch = (Array.isArray(payload) ? payload : [payload]) as Row[];
        const inserted: Row[] = [];
        for (const candidate of batch) {
          const duplicate =
            upsertOptions?.ignoreDuplicates === true &&
            conflictColumns.length > 0 &&
            rows.some((existing) =>
              conflictColumns.every((column) => existing[column] === candidate[column]),
            );
          if (duplicate) continue;
          const row: Row = { id: `${table}-${++idCounter}`, ...candidate };
          rows.push(row);
          calls.upserts.push({ table, row: { ...row } });
          inserted.push(row);
        }
        return { data: inserted, error: null };
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
      const limited = limitN === undefined ? found : found.slice(0, limitN);
      return {
        data: rangeBounds ? limited.slice(rangeBounds[0], rangeBounds[1] + 1) : limited,
        error: null,
      };
    }

    const query = {
      select: () => query,
      insert: (value: Row | Row[]) => {
        op = "insert";
        payload = value;
        return query;
      },
      upsert: (
        value: Row | Row[],
        options?: { onConflict?: string; ignoreDuplicates?: boolean },
      ) => {
        op = "upsert";
        payload = value;
        upsertOptions = options;
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
      gt: (column: string, value: unknown) => {
        predicates.push((row) => Date.parse(String(row[column])) > Date.parse(String(value)));
        filterLabels.push(`${column}>`);
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
      range: (from: number, to: number) => {
        rangeBounds = [from, to];
        calls.ranges.push({ table, from, to });
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
    failureSequences,
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
