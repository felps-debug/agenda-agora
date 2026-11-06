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
  isHeicImage,
  LOGO_MAX_SIZE_BYTES,
  normalizeImageFile,
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

describe("upload de imagem aceita mais formatos + converte HEIC (US4)", () => {
  afterEach(() => vi.unstubAllGlobals());

  const pngSignature = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpegSignature = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const webpSignature = Uint8Array.from([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);

  it("detecta HEIC/HEIF por MIME e por extensão (type vazio de celular)", () => {
    expect(isHeicImage({ type: "image/heic", name: "foto.HEIC" })).toBe(true);
    expect(isHeicImage({ type: "image/heif", name: "foto.heif" })).toBe(true);
    expect(isHeicImage({ type: "", name: "IMG_0001.heic" })).toBe(true);
    expect(isHeicImage({ type: "application/octet-stream", name: "IMG.HEIF" })).toBe(true);
    expect(isHeicImage({ type: "image/jpeg", name: "foto.jpg" })).toBe(false);
    expect(isHeicImage({ type: "", name: "foto.jpg" })).toBe(false);
  });

  it("converte HEIC para JPEG via conversor injetado (import dinâmico na prod)", async () => {
    const convert = vi
      .fn<(blob: Blob) => Promise<Blob>>()
      .mockResolvedValue(new Blob([jpegSignature], { type: "image/jpeg" }));
    const heic = new File([new Uint8Array([0, 0, 0, 0])], "IMG_0001.heic", { type: "image/heic" });
    const out = await normalizeImageFile(heic, convert);
    expect(convert).toHaveBeenCalledOnce();
    expect(out.type).toBe("image/jpeg");
    expect(out.name).toBe("IMG_0001.jpg");
  });

  it("não converte quem já é exibível (passa direto, sem baixar o conversor)", async () => {
    const convert = vi.fn<(blob: Blob) => Promise<Blob>>();
    const png = new File([pngSignature], "arte.png", { type: "image/png" });
    const out = await normalizeImageFile(png, convert);
    expect(convert).not.toHaveBeenCalled();
    expect(out).toBe(png);
  });

  it("aceita JPEG e WebP válidos após normalização", async () => {
    await expect(
      validateLogoFile(new Blob([jpegSignature], { type: "image/jpeg" }) as File, "service"),
    ).resolves.toEqual({ valid: true, extension: "jpg" });
    await expect(
      validateLogoFile(new Blob([webpSignature], { type: "image/webp" }) as File, "service"),
    ).resolves.toEqual({ valid: true, extension: "webp" });
  });

  it("recusa não-imagem (PDF) com mensagem clara de serviço", async () => {
    const pdf = new Blob([Uint8Array.from([0x25, 0x50, 0x44, 0x46])], {
      type: "application/pdf",
    }) as File;
    const v = await validateLogoFile(pdf, "service");
    expect(v.valid).toBe(false);
    if (!v.valid) expect(v.message).toContain("imagem do serviço");
  });

  it("aplica o limite de 5 MB após a conversão", async () => {
    const big = {
      type: "image/jpeg",
      size: LOGO_MAX_SIZE_BYTES + 1,
      arrayBuffer: async () => jpegSignature.buffer,
    };
    const v = await validateLogoFile(big, "service");
    expect(v.valid).toBe(false);
    if (!v.valid) expect(v.message).toMatch(/5 MB/);
  });
});
