import { z } from "zod";

export const OUTREACH_MESSAGE_PLACEHOLDERS = [
  "{nome}",
  "{servico}",
  "{hora}",
  "{data}",
  "{negocio}",
  "{Cliente}",
  "{Saudacao}",
  "{Link}",
  "{Data}",
  "{Horario}",
  "{Serviço}",
  "{Funcionario}",
  "{Valor}",
] as const;

export function validateOutreachMessage(text: string) {
  const tokens = text.match(/\{[^{}]+\}/g) ?? [];
  return tokens.every((token) =>
    (OUTREACH_MESSAGE_PLACEHOLDERS as readonly string[]).includes(token),
  );
}

export const outreachMessageSchema = z
  .string()
  .max(2000)
  .refine(validateOutreachMessage, {
    message: `Use apenas: ${OUTREACH_MESSAGE_PLACEHOLDERS.join(", ")}.`,
  });

export function toggleOutreachTemplateSelection(ids: string[], id: string, checked: boolean) {
  if (checked) return ids.includes(id) ? ids : [...ids, id];
  return ids.filter((item) => item !== id);
}

/**
 * Mensagem de lembrete ("Avisar") fixa do sistema: enviada exatamente assim
 * para todos os estabelecimentos, sem personalização.
 */
export const FIXED_REMINDER_TEMPLATE =
  "{Saudacao} {Cliente}, só estou passando aqui para lembrar que você tem um horário agendado conosco hoje às {Horario} 🥰\nEspero por você, até breve! 👋";
