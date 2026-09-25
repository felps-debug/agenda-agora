import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";

// T049 (spec 002, US8): o acesso Master passa a ser login normal por e-mail+senha forte
// com role super_admin; o bootstrap por código fixo e a promoção pública deixam de existir.
// Nenhuma credencial é registrada aqui (nem valor nem derivado do código legado).

const runtime = vi.hoisted(() => ({
  superAdminRow: null as null | { user_id: string },
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
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: runtime.superAdminRow, error: null }),
  };
  return { supabaseAdmin: { from: () => query } };
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
});
