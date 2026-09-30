import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createSignedUrl = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ createSignedUrl }) } },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import {
  assertStoredBusinessImage,
  decodeBusinessImageFile,
  getBusinessImageUrl,
  getLogoUrl,
  validateLogoFile,
} from "./logo";

const businessId = "11111111-1111-4111-8111-111111111111";

describe("assinatura da logo", () => {
  beforeEach(() => {
    createSignedUrl.mockReset();
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.test/logo" },
      error: null,
    });
  });

  it("assina somente uma imagem do negócio", async () => {
    await expect(getLogoUrl(`${businessId}/logo-x.png`, businessId)).resolves.toBe(
      "https://example.test/logo",
    );
    expect(createSignedUrl).toHaveBeenCalledWith(`${businessId}/logo-x.png`, 60 * 60 * 24);
  });

  it("gera URL assinada legível para imagem pública de serviço", async () => {
    const path = `${businessId}/services/service-1.webp`;
    await expect(getBusinessImageUrl(path, businessId, "service")).resolves.toBe(
      "https://example.test/logo",
    );
    expect(createSignedUrl).toHaveBeenCalledWith(path, 60 * 60 * 24);
  });

  it("nega imagem de outro negócio antes de pedir URL assinada", async () => {
    const otherBusinessPath = "22222222-2222-4222-8222-222222222222/services/service-1.webp";
    await expect(getBusinessImageUrl(otherBusinessPath, businessId, "service")).resolves.toBeNull();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("não assina nem expõe panel1-settings.json", async () => {
    await expect(
      getBusinessImageUrl(`${businessId}/panel1-settings.json`, businessId, "service"),
    ).resolves.toBeNull();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it.each([
    `${businessId}/panel1-settings.json`,
    `${businessId}/services/x.png`,
    "22222222-2222-4222-8222-222222222222/logo-x.png",
  ])("nunca assina um caminho inválido: %s", async (path) => {
    await expect(getLogoUrl(path, businessId)).resolves.toBeNull();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});

describe("validação do arquivo de imagem", () => {
  afterEach(() => vi.unstubAllGlobals());

  const pngSignature = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it("recusa 500 bytes zerados com MIME image/png", async () => {
    const validation = await validateLogoFile(
      new Blob([new Uint8Array(500)], { type: "image/png" }) as File,
    );
    expect(validation.valid).toBe(false);
    if (!validation.valid) expect(validation.message).toMatch(/imagem PNG, JPEG ou WebP válida/);
  });

  it("usa o contexto de imagem do serviço nas mensagens de validação", async () => {
    const validation = await validateLogoFile(
      new Blob([new Uint8Array(500)], { type: "image/png" }) as File,
      "service",
    );
    expect(validation.valid).toBe(false);
    if (!validation.valid) {
      expect(validation.message).toContain("imagem do serviço");
      expect(validation.message).not.toContain("logotipo");
    }
  });

  it("recusa conteúdo PNG com MIME JPEG trocado", async () => {
    const validation = await validateLogoFile(
      new Blob([pngSignature], { type: "image/jpeg" }) as File,
    );
    expect(validation.valid).toBe(false);
  });

  it("aceita assinatura PNG e exige que o navegador decodifique antes do envio", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 1, height: 1, close }));
    const file = new Blob([pngSignature], { type: "image/png" });
    const validation = await validateLogoFile(file as File);
    expect(validation).toEqual({ valid: true, extension: "png" });
    await expect(decodeBusinessImageFile(file)).resolves.toBe(true);
    expect(close).toHaveBeenCalledOnce();
  });

  it("recusa arquivo que o navegador não consegue decodificar", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("imagem inválida")));
    await expect(decodeBusinessImageFile(new Blob([new Uint8Array(500)]))).resolves.toBe(false);
  });

  it("confere assinatura do objeto armazenado no servidor", async () => {
    const download = vi.fn().mockResolvedValue({
      data: new Blob([pngSignature], { type: "image/png" }),
      error: null,
    });
    const storageClient = { storage: { from: () => ({ download }) } } as never;
    await expect(
      assertStoredBusinessImage(storageClient, businessId + "/logo-good.png", businessId, "logo"),
    ).resolves.toBeUndefined();
    await expect(
      assertStoredBusinessImage(
        storageClient,
        businessId + "/logo-swapped.jpg",
        businessId,
        "logo",
      ),
    ).rejects.toThrow(/imagem PNG, JPEG ou WebP válida/);
  });
});
