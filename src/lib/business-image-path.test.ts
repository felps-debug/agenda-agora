import { describe, expect, it } from "vitest";
import {
  businessImageSignatureMatchesPath,
  detectBusinessImageMimeType,
  isBusinessImagePath,
} from "./business-image-path";

const businessId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";

describe("caminhos públicos de imagens", () => {
  it("aceita somente logo, serviço e fundo do próprio negócio", () => {
    expect(isBusinessImagePath(`${businessId}/logo-123.webp`, businessId, "logo")).toBe(true);
    expect(isBusinessImagePath(`${businessId}/services/abc.jpg`, businessId, "service")).toBe(true);
    expect(isBusinessImagePath(`${businessId}/background-abc.jpg`, businessId, "background")).toBe(
      true,
    );
    expect(isBusinessImagePath(`${otherId}/logo-123.webp`, businessId, "logo")).toBe(false);
    expect(isBusinessImagePath(`${otherId}/services/abc.jpg`, businessId, "service")).toBe(false);
    expect(isBusinessImagePath(`${otherId}/background-abc.jpg`, businessId, "background")).toBe(
      false,
    );
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

describe("assinaturas binárias de imagens", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
  const webp = Uint8Array.from([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);

  it.each([
    ["PNG", png, "image/png"],
    ["JPEG", jpeg, "image/jpeg"],
    ["WebP", webp, "image/webp"],
  ] as const)("detecta a assinatura real de %s", (_name, bytes, mimeType) => {
    expect(detectBusinessImageMimeType(bytes)).toBe(mimeType);
  });

  it("recusa um arquivo de 500 bytes zerados mesmo com MIME image/png", () => {
    expect(detectBusinessImageMimeType(new Uint8Array(500))).toBeNull();
    expect(
      businessImageSignatureMatchesPath(
        new Uint8Array(500),
        businessId + "/logo-broken.png",
        businessId,
        "logo",
      ),
    ).toBe(false);
  });

  it("recusa assinatura válida com extensão trocada", () => {
    expect(
      businessImageSignatureMatchesPath(
        png,
        businessId + "/services/photo.jpg",
        businessId,
        "service",
      ),
    ).toBe(false);
  });
});
