import { describe, expect, it } from "vitest";
import {
  appSurfaceForHostname,
  appSurfaceHref,
  panelPathHref,
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
});
