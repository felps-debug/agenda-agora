import { describe, expect, it } from "vitest";
import { publicBookingPath, publicBookingUrl } from "./public-booking-link";

describe("link público de agendamento", () => {
  it("monta a URL absoluta com a origem atual", () => {
    expect(publicBookingUrl("https://app.agendaagora.test", "barbearia-centro")).toBe(
      "https://app.agendaagora.test/agendar/barbearia-centro",
    );
  });

  it("não duplica a barra final da origem", () => {
    expect(publicBookingUrl("http://localhost:3000/", "studio")).toBe(
      "http://localhost:3000/agendar/studio",
    );
  });

  it("usa só o caminho enquanto a origem não é conhecida", () => {
    expect(publicBookingUrl(null, "studio")).toBe("/agendar/studio");
    expect(publicBookingUrl("", "studio")).toBe("/agendar/studio");
  });

  it("codifica caracteres que quebrariam a rota", () => {
    expect(publicBookingPath("a b/c")).toBe("/agendar/a%20b%2Fc");
  });

  it.each([null, undefined, "", "   "])("não gera link sem slug: %s", (slug) => {
    expect(publicBookingPath(slug)).toBeNull();
    expect(publicBookingUrl("https://app.agendaagora.test", slug)).toBeNull();
  });
});
