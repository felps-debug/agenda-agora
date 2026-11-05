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

/** Texto padrão do "Avisar" (lembrete). O estabelecimento pode editar; o que salvar vale. */
export const DEFAULT_REMINDER_TEMPLATE =
  "Olá, {Cliente}, só estou passando aqui para lembrar que você tem um horário agendado comigo hoje às {Horario}.\nEspero por você, até breve! 👋";

/** Texto padrão do "Resumo" enviado ao confirmar o agendamento. Editável. */
export const DEFAULT_SUMMARY_TEMPLATE =
  "❕ Resumo do seu agendamento:\n\n📅 Data: {Data}\n🕗 Hora: {Horario}\n🛠 Serviço: {Serviço}\n👤 Profissional: {Funcionario}\n💰 Valor: R$ {Valor}";

/**
 * Textos que o sistema gravou no banco enquanto Resumo/Avisar eram fixos
 * (commit aa4a32e). Contam como "nunca personalizado" e voltam para o padrão novo.
 */
const LEGACY_REMINDER_TEMPLATES = [
  "{Saudacao} {Cliente}, só estou passando aqui para lembrar que você tem um horário agendado conosco hoje às {Horario} 🥰\nEspero por você, até breve! 👋",
];
const LEGACY_SUMMARY_TEMPLATES = [
  "❕ Resumo de seu agendamento:\n\n📅 Data: {Data}\n🕗 Hora: {Horario}\n🛠 Serviço: {Serviço}\n👤 Profissional: {Funcionario}\n💰 Valor: R$ {Valor}",
];

function resolveTemplate(stored: string | null | undefined, fallback: string, legacy: string[]) {
  if (!stored || !stored.trim() || legacy.includes(stored)) return fallback;
  return stored;
}

export function resolveReminderTemplate(stored: string | null | undefined) {
  return resolveTemplate(stored, DEFAULT_REMINDER_TEMPLATE, LEGACY_REMINDER_TEMPLATES);
}

export function resolveSummaryTemplate(stored: string | null | undefined) {
  return resolveTemplate(stored, DEFAULT_SUMMARY_TEMPLATE, LEGACY_SUMMARY_TEMPLATES);
}
