import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  appSurfaceForHostname,
  appSurfaceHref,
  panelPathHref,
  masterPanelRedirectHref,
  publicBookingOrigin,
} from "./app-hosts";

const productionLocation = {
  hostname: "app.agendagora.company",
  protocol: "https:",
};

describe("separação dos painéis por subdomínio", () => {
  it("identifica cada superfície", () => {
    expect(appSurfaceForHostname("app.agendagora.company", true)).toBe("public");
    expect(appSurfaceForHostname("painel.agendagora.company", true)).toBe("panel");
    expect(appSurfaceForHostname("admin.agendagora.company", true)).toBe("admin");
    expect(appSurfaceForHostname("localhost", true)).toBeNull();
  });

  it("leva o painel do estabelecimento e o master para hosts diferentes", () => {
    expect(panelPathHref("/painel", productionLocation, true)).toBe(
      "https://painel.agendagora.company/painel",
    );
    expect(panelPathHref("/painel/master", productionLocation, true)).toBe(
      "https://admin.agendagora.company/painel/master",
    );
  });

  it("mantém todas as páginas da barra lateral do master no host admin", () => {
    for (const path of [
      "/painel/recebiveis",
      "/painel/em-teste",
      "/painel/assinantes",
      "/painel/precisa-de-atencao",
      "/painel/pix-aprovacao",
      "/painel/carteira-desempenho",
      "/painel/carteira-config",
      "/painel/transacoes",
      "/painel/notificacoes-alertas",
      "/painel/equipe-geral",
      "/painel/suporte",
      "/painel/erros",
    ]) {
      expect(panelPathHref(path, productionLocation, true)).toBe(
        `https://admin.agendagora.company${path}`,
      );
    }
    expect(panelPathHref("/painel/servicos", productionLocation, true)).toBe(
      "https://painel.agendagora.company/painel/servicos",
    );
  });

  it("preserva rotas relativas em desenvolvimento e previews", () => {
    expect(
      appSurfaceHref("admin", "/painel/master", { hostname: "localhost", protocol: "http:" }, true),
    ).toBe("/painel/master");
  });

  it("gera links públicos sempre no Painel 1", () => {
    expect(publicBookingOrigin("https://painel.agendagora.company", true)).toBe(
      "https://app.agendagora.company",
    );
    expect(publicBookingOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("mantém o host atual enquanto a separação não foi ativada", () => {
    expect(appSurfaceForHostname("app.agendagora.company", false)).toBeNull();
    expect(publicBookingOrigin("https://painel.agendagora.company", false)).toBe(
      "https://painel.agendagora.company",
    );
  });

  it("mantém o dono no host em que a sessão de suporte foi criada", () => {
    expect(
      masterPanelRedirectHref(
        "/painel",
        { hostname: "admin.agendagora.company", protocol: "https:" },
        { isMaster: false, supportState: "on" },
        true,
      ),
    ).toBeNull();
    expect(
      masterPanelRedirectHref(
        "/painel",
        { hostname: "admin.agendagora.company", protocol: "https:" },
        { isMaster: false, supportState: "off" },
        true,
      ),
    ).toBeNull();
  });

  it.each(["checking", "on"] as const)(
    "ignora status antigo de master durante suporte %s",
    (supportState) => {
      expect(
        masterPanelRedirectHref(
          "/painel",
          { hostname: "admin.agendagora.company", protocol: "https:" },
          { isMaster: true, supportState },
          true,
        ),
      ).toBeNull();
    },
  );

  it("leva um master fora do suporte para o domínio administrativo", () => {
    expect(
      masterPanelRedirectHref(
        "/painel/erros",
        { hostname: "painel.agendagora.company", protocol: "https:" },
        { isMaster: true, supportState: "off" },
        true,
      ),
    ).toBe("https://admin.agendagora.company/painel/erros");
  });

  it("não recarrega uma página que já está na origem correta", () => {
    expect(
      masterPanelRedirectHref(
        "/painel/master",
        { hostname: "admin.agendagora.company", protocol: "https:" },
        { isMaster: true, supportState: "off" },
        true,
      ),
    ).toBeNull();
    expect(
      masterPanelRedirectHref(
        "/painel/master",
        { hostname: "localhost", protocol: "http:", port: "3002" },
        { isMaster: true, supportState: "off" },
        true,
      ),
    ).toBeNull();
  });
});

describe("rotas exclusivas do master", () => {
  it("toda rota com requireMasterAccess abre no host admin (senão volta pro login)", () => {
    const dir = join(process.cwd(), "src/routes/_authenticated");
    const masterRoutes = readdirSync(dir)
      .filter((f) => /^painel\..+\.tsx$/.test(f) && !f.endsWith(".test.tsx"))
      .filter((f) => readFileSync(join(dir, f), "utf8").includes("requireMasterAccess"))
      .map((f) => "/painel/" + f.replace(/^painel\./, "").replace(/\.tsx$/, ""));
    expect(masterRoutes.length).toBeGreaterThan(5);
    for (const path of masterRoutes) {
      expect(panelPathHref(path, productionLocation, true), path).toBe(
        `https://admin.agendagora.company${path}`,
      );
    }
  });
});
