import { describe, expect, it } from "vitest";
import { cancellationSuccessMessage } from "./cancellation-feedback";

describe("cancellationSuccessMessage", () => {
  it("does not promise renewed access after reverting cancellation", () => {
    expect(cancellationSuccessMessage("reverter")).toBe(
      "Cancelamento revertido. A vigencia do plano continua determinando o acesso.",
    );
  });

  it("keeps clear messages for requesting and effecting cancellation", () => {
    expect(cancellationSuccessMessage("solicitar")).toBe("Cancelamento solicitado registrado.");
    expect(cancellationSuccessMessage("efetivar")).toBe("Cancelamento efetivado.");
  });
});
