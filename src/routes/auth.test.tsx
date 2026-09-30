import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  loginInputMode,
  postLoginDestination,
  resolveLoginCredentials,
} from "@/lib/auth/login-flow";

// T049 (spec 002, US8) — a mesma tela /auth aceita telefone+PIN do dono (fluxo
// atual preservado) e e-mail+senha forte do administrador, decidindo pelo
// formato do identificador; super_admin vai direto para o Master. Valores
// abaixo são fictícios.
//
// Contrato em src/lib/auth/login-flow.ts (usado por src/routes/auth.tsx):
//   resolveLoginCredentials(identifier, secret) =>
//     { kind: "owner" | "admin"; email: string; password: string }  (lança Error se inválido)
//   postLoginDestination({ roles }) => "/painel" | "/painel/master" | null

const ROOT = process.cwd();

describe("login do dono por telefone + PIN (preservado)", () => {
  it("mantém o campo de senha restrito ao PIN numérico de 4 dígitos", () => {
    expect(loginInputMode("(11) 93935-4416")).toMatchObject({
      email: false,
      label: "Senha de 4 dígitos",
      inputMode: "numeric",
      maxLength: 4,
      pattern: "\\d{4}",
    });
    expect(resolveLoginCredentials("(11) 93935-4416", "1234").kind).toBe("owner");
  });

  it("mantém o e-mail sintético e a senha derivada do PIN", () => {
    expect(resolveLoginCredentials("(11) 93935-4416", "1234")).toEqual({
      kind: "owner",
      email: "11939354416@agenda.local",
      password: "agendaagora:1234",
    });
  });

  it("exige telefone com DDD", () => {
    expect(() => resolveLoginCredentials("93935-4416", "1234")).toThrow(/DDD/);
  });

  it("exige PIN de exatamente 4 dígitos", () => {
    expect(() => resolveLoginCredentials("(11) 93935-4416", "123")).toThrow(/4 dígitos/);
  });
});

describe("login do administrador por e-mail + senha forte", () => {
  it("deixa a senha livre, sem limite ou padrão de PIN", () => {
    expect(loginInputMode("master@exemplo.test")).toMatchObject({
      email: true,
      label: "Senha",
      inputMode: "text",
      maxLength: undefined,
      pattern: undefined,
    });
    expect(
      resolveLoginCredentials("master@exemplo.test", "senha longa com espaços 123!"),
    ).toMatchObject({ kind: "admin", password: "senha longa com espaços 123!" });
  });

  it("usa o e-mail informado (normalizado) e a senha sem transformação", () => {
    expect(resolveLoginCredentials("  Admin.Teste@Exemplo.test ", "senha-forte-ficticia")).toEqual({
      kind: "admin",
      email: "admin.teste@exemplo.test",
      password: "senha-forte-ficticia",
    });
  });

  it("recusa e-mail sintético @agenda.local no fluxo de administrador (conta legada)", () => {
    expect(() =>
      resolveLoginCredentials("00000000@agenda.local", "senha-forte-ficticia"),
    ).toThrow();
  });
});

describe("destino após o login", () => {
  it("dono continua indo para o painel", () => {
    expect(postLoginDestination({ roles: ["owner"] })).toBe("/painel");
  });

  it("super_admin vai direto para o Master", () => {
    expect(postLoginDestination({ roles: ["super_admin"] })).toBe("/painel/master");
  });

  it("funcionário (professional) também vai para o painel", () => {
    expect(postLoginDestination({ roles: ["professional"] })).toBe("/painel");
  });

  it("conta sem role não recebe destino", () => {
    expect(postLoginDestination({ roles: [] })).toBeNull();
  });
});

describe("rota e textos legados do Master removidos", () => {
  it("não existe mais a rota /master-login", () => {
    expect(existsSync(join(ROOT, "src", "routes", "master-login.tsx"))).toBe(false);
    expect(readFileSync(join(ROOT, "src", "routeTree.gen.ts"), "utf8")).not.toContain(
      "/master-login",
    );
  });

  it("/auth não rejeita mais super_admin mandando usar o acesso exclusivo", () => {
    const source = readFileSync(join(ROOT, "src", "routes", "auth.tsx"), "utf8");
    expect(source).not.toMatch(/acesso exclusivo do Master/);
  });
});
