import { beforeEach, describe, expect, it, vi } from "vitest";

const createSignedUrl = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ createSignedUrl }) } },
}));

import { getLogoUrl } from "./logo";

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

  it.each([
    `${businessId}/panel1-settings.json`,
    `${businessId}/services/x.png`,
    "22222222-2222-4222-8222-222222222222/logo-x.png",
  ])("nunca assina um caminho inválido: %s", async (path) => {
    await expect(getLogoUrl(path, businessId)).resolves.toBeNull();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
