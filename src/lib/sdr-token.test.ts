import { describe, expect, it } from "vitest";
import { signSdrToken, verifySdrToken, verifySdrTokenClaims } from "./sdr-token";

const SECRET = "segredo-de-teste";

describe("sdr-token", () => {
  it("assinatura válida retorna o id do SDR", () => {
    const token = signSdrToken("sdr-1", SECRET);
    expect(verifySdrToken(token, SECRET)).toBe("sdr-1");
  });

  it("rejeita segredo diferente", () => {
    const token = signSdrToken("sdr-1", SECRET);
    expect(verifySdrToken(token, "outro-segredo")).toBeNull();
  });

  it("rejeita token expirado", () => {
    const past = Date.now() - 1000 * 60 * 60 * 24 * 31; // além do TTL de 30 dias
    const token = signSdrToken("sdr-1", SECRET, past);
    expect(verifySdrToken(token, SECRET)).toBeNull();
  });

  it("rejeita token adulterado", () => {
    const token = signSdrToken("sdr-1", SECRET);
    const [body] = token.split(".");
    if (!body) throw new Error("token sem corpo");
    const forged = `${body}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    expect(verifySdrToken(forged, SECRET)).toBeNull();
    expect(verifySdrToken("lixo", SECRET)).toBeNull();
  });

  it("assina e retorna a versao de sessao sem quebrar tokens legados de versao zero", () => {
    const legacy = signSdrToken("sdr-1", SECRET);
    const current = signSdrToken("sdr-1", SECRET, Date.now(), 4);

    expect(verifySdrTokenClaims(legacy, SECRET)).toMatchObject({
      sdrId: "sdr-1",
      sessionVersion: 0,
    });
    expect(verifySdrTokenClaims(current, SECRET)).toMatchObject({
      sdrId: "sdr-1",
      sessionVersion: 4,
    });
    expect(verifySdrToken(current, SECRET)).toBe("sdr-1");
  });
});
