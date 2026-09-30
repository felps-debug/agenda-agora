import { describe, expect, it } from "vitest";
import { friendlyError } from "./error-page";

describe("friendlyError", () => {
  it("converte erros do Zod serializados para português e identifica o campo", () => {
    const error = new Error(
      JSON.stringify([
        {
          code: "invalid_type",
          expected: "number",
          received: "undefined",
          path: ["amount"],
          message: "Required",
        },
      ]),
    );
    expect(friendlyError(error)).toBe("O campo Valor é obrigatório.");
  });

  it("converte falhas de rede e timeout em uma orientação acionável", () => {
    expect(friendlyError(new Error("Failed to fetch"))).toContain("Confira sua internet");
    expect(friendlyError(new Error("Request timeout"))).toContain("Tente novamente");
  });

  it("mapeia status 401 e 403 sem exibir códigos", () => {
    expect(friendlyError({ status: 401, message: "Unauthorized" })).toContain("sessão expirou");
    expect(friendlyError({ status: 403, message: "Forbidden" })).toContain("permissão");
    expect(friendlyError({ status: 500, message: "Internal server error" })).not.toContain("500");
  });

  it.each([401, 403, 422])("mostra erro neutro para falha do provedor com status %s", (status) => {
    const error = Object.assign(new Error("Falha na comunicação com o AgPay."), {
      name: "AgpayApiError",
      status,
    });
    const message = friendlyError(error);

    expect(message).toBe(
      "Não foi possível concluir o pagamento agora. Tente novamente em instantes ou fale com o estabelecimento.",
    );
    expect(message).not.toMatch(/AgPay|sessão expirou|permissão/i);
  });

  it("usa orientação genérica para erro desconhecido sem vazar dados técnicos", () => {
    expect(
      friendlyError(
        new Error("TypeError: database_connection_failed at internal.ts:42"),
        "salvar o serviço",
      ),
    ).toBe("Não foi possível salvar o serviço. Tente novamente.");
    expect(friendlyError(new Error("stack trace AgPay invalid_type"))).not.toMatch(
      /AgPay|invalid_type|stack trace/,
    );
  });
});
