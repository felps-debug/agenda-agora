import { describe, expect, it } from "vitest";
import { isBusinessImagePath } from "./business-image-path";

const businessId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";

describe("caminhos públicos de imagens", () => {
  it("aceita somente logo e serviço do próprio negócio", () => {
    expect(isBusinessImagePath(`${businessId}/logo-123.webp`, businessId, "logo")).toBe(true);
    expect(isBusinessImagePath(`${businessId}/services/abc.jpg`, businessId, "service")).toBe(true);
    expect(isBusinessImagePath(`${otherId}/logo-123.webp`, businessId, "logo")).toBe(false);
    expect(isBusinessImagePath(`${otherId}/services/abc.jpg`, businessId, "service")).toBe(false);
  });

  it("recusa JSON, tipo trocado e subpastas inesperadas", () => {
    expect(isBusinessImagePath(`${businessId}/panel1-settings.json`, businessId, "logo")).toBe(
      false,
    );
    expect(isBusinessImagePath(`${businessId}/logo-x.json`, businessId, "logo")).toBe(false);
    expect(isBusinessImagePath(`${businessId}/services/a.png`, businessId, "logo")).toBe(false);
    expect(isBusinessImagePath(`${businessId}/logo-a.png`, businessId, "service")).toBe(false);
    expect(isBusinessImagePath(`${businessId}/services/nested/a.png`, businessId, "service")).toBe(
      false,
    );
  });
});
