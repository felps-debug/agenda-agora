import { describe, expect, it } from "vitest";
import { maskCpfCnpj, maskDateBR, maskPhoneBR } from "./input-masks";

describe("máscaras progressivas de campos brasileiros", () => {
  it("telefone celular pontua conforme a pessoa digita", () => {
    expect(maskPhoneBR("9")).toBe("(9");
    expect(maskPhoneBR("1198")).toBe("(11) 98");
    expect(maskPhoneBR("119888877")).toBe("(11) 9888-877");
    expect(maskPhoneBR("11988887777")).toBe("(11) 98888-7777");
  });

  it("telefone fixo fica com 8 números após o DDD", () => {
    expect(maskPhoneBR("1133334444")).toBe("(11) 3333-4444");
  });

  it("telefone colado com DDI 55 perde o prefixo", () => {
    expect(maskPhoneBR("+5511988887777")).toBe("(11) 98888-7777");
    expect(maskPhoneBR("551133334444")).toBe("(11) 3333-4444");
  });

  it("telefone não passa de DDD + 11 dígitos", () => {
    expect(maskPhoneBR("119888877771234")).toBe("(11) 98888-7777");
  });

  it("CPF pontua até 11 dígitos", () => {
    expect(maskCpfCnpj("123")).toBe("123");
    expect(maskCpfCnpj("123456")).toBe("123.456");
    expect(maskCpfCnpj("123456789")).toBe("123.456.789");
    expect(maskCpfCnpj("12345678901")).toBe("123.456.789-01");
  });

  it("CNPJ troca de máscara a partir do 12º dígito", () => {
    expect(maskCpfCnpj("123456789012")).toBe("12.345.678/9012");
    expect(maskCpfCnpj("12345678901234")).toBe("12.345.678/9012-34");
  });

  it("CPF restrito a 11 dígitos não aceita mais", () => {
    expect(maskCpfCnpj("123456789012", 11)).toBe("123.456.789-01");
  });

  it("descarta tudo que não é dígito", () => {
    expect(maskCpfCnpj("123.456.789-00abc")).toBe("123.456.789-00");
    expect(maskDateBR("15/03/2026x")).toBe("15/03/2026");
  });

  it("data de nascimento pontua no formato DD/MM/AAAA", () => {
    expect(maskDateBR("2")).toBe("2");
    expect(maskDateBR("281")).toBe("28/1");
    expect(maskDateBR("2810")).toBe("28/10");
    expect(maskDateBR("28102026")).toBe("28/10/2026");
  });
});
