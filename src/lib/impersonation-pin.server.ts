import { timingSafeEqual } from "node:crypto";
import { getMasterReturnPin } from "@/lib/env-security.server";

/**
 * PIN fixo da equipe para encerrar uma impersonação e voltar ao Painel 3.
 *
 * ARQUIVO SERVER-ONLY (.server.ts): nunca é incluído no bundle do cliente,
 * então o PIN jamais chega ao navegador — a conferência acontece só no servidor.
 */

export function masterReturnPinMatches(pin: string) {
  const expected = Buffer.from(getMasterReturnPin());
  const actual = Buffer.from(pin.trim());
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
