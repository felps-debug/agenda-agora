import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIRMATION_MESSAGE,
  DEFAULT_REMINDER_MESSAGE,
  renderMessage,
} from "./whatsapp-notify.server";

describe("renderMessage", () => {
  const vars = {
    nome: "Maria",
    servico: "Corte",
    hora: "14:30",
    data: "20/09",
    negocio: "Barbearia do João",
  };

  it("substitui todos os placeholders conhecidos", () => {
    const out = renderMessage(DEFAULT_CONFIRMATION_MESSAGE, vars);
    expect(out).toContain("Maria");
    expect(out).toContain("Corte");
    expect(out).toContain("20/09");
    expect(out).toContain("14:30");
    expect(out).toContain("Barbearia do João");
    expect(out).not.toContain("{");
  });

  it("também funciona no template de lembrete", () => {
    const out = renderMessage(DEFAULT_REMINDER_MESSAGE, vars);
    expect(out).not.toContain("{");
  });

  it("ignora placeholders desconhecidos deixando o texto como está", () => {
    expect(renderMessage("Olá {nome}, código {codigo}", vars)).toBe("Olá Maria, código {codigo}");
  });

  it("um template customizado pelo dono também funciona", () => {
    expect(renderMessage("{nome}, {servico} confirmado!", vars)).toBe("Maria, Corte confirmado!");
  });
});
