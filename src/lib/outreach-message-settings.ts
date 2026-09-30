import { z } from "zod";

export const OUTREACH_MESSAGE_PLACEHOLDERS = [
  "{nome}",
  "{servico}",
  "{hora}",
  "{data}",
  "{negocio}",
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
