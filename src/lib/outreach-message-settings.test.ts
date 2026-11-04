import { describe, expect, it } from "vitest";
import {
  outreachMessageSchema,
  toggleOutreachTemplateSelection,
  validateOutreachMessage,
} from "./outreach-message-settings";

describe("configuração das mensagens de divulgação", () => {
  it("aceita placeholders conhecidos e rejeita nomes desconhecidos", () => {
    expect(validateOutreachMessage("Olá {nome}, seu horário é {hora} em {negocio}.")).toBe(true);
    expect(validateOutreachMessage("👋 {negocio} {Cliente}! Agende em {Link}")).toBe(true);
    expect(validateOutreachMessage("{Saudacao}, passe em {Link}")).toBe(true);
    expect(
      validateOutreachMessage(
        "❕ Resumo: 📅 {Data} 🕗 {Horario} 🛠 {Serviço} 👤 {Funcionario} 💰 {Valor}",
      ),
    ).toBe(true);
    expect(validateOutreachMessage("Olá {cliente}")).toBe(false);
    expect(() => outreachMessageSchema.parse("Mensagem {cliente}")).toThrow();
  });

  it("adiciona e remove templates selecionados sem duplicar IDs", () => {
    expect(toggleOutreachTemplateSelection(["a"], "b", true)).toEqual(["a", "b"]);
    expect(toggleOutreachTemplateSelection(["a", "a"], "a", true)).toEqual(["a", "a"]);
    expect(toggleOutreachTemplateSelection(["a", "b"], "a", false)).toEqual(["b"]);
  });
});
