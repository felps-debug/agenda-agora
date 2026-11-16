import { describe, expect, it, vi } from "vitest";
import { submitSupportDraft } from "./support-draft";

describe("submitSupportDraft", () => {
  it("limpa o rascunho somente depois do envio confirmado", async () => {
    let resolveSend: (() => void) | undefined;
    const send = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve;
        }),
    );
    const clearDraft = vi.fn();
    const submitted = submitSupportDraft("  Olá, tudo bem?  ", send, clearDraft);

    expect(send).toHaveBeenCalledWith("Olá, tudo bem?");
    expect(clearDraft).not.toHaveBeenCalled();

    resolveSend?.();
    await submitted;

    expect(clearDraft).toHaveBeenCalledOnce();
    expect(clearDraft).toHaveBeenCalledWith("  Olá, tudo bem?  ");
  });

  it("preserva o rascunho quando o envio falha", async () => {
    const send = vi.fn().mockRejectedValue(new Error("Falha temporária"));
    const clearDraft = vi.fn();

    await expect(submitSupportDraft("Resposta", send, clearDraft)).rejects.toThrow(
      "Falha temporária",
    );
    expect(clearDraft).not.toHaveBeenCalled();
  });
});
