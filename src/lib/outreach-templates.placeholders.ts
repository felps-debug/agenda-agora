type BusinessPlaceholderData = {
  name: string | null;
  category: string | null;
  phone: string | null;
  address: string | null;
  slug: string;
};

const PLACEHOLDERS: Record<string, (business: BusinessPlaceholderData) => string> = {
  "{nome_empresa}": (business) => business.name ?? "",
  "{categoria}": (business) => business.category ?? "",
  "{telefone}": (business) => business.phone ?? "",
  "{endereco}": (business) => business.address ?? "",
  "{link_publico}": (business) => `/agendar/${business.slug}`,
};

/** Substitui os placeholders de um template pelos dados do negócio; campo ausente vira string vazia. */
export function applyOutreachPlaceholders(body: string, business: BusinessPlaceholderData): string {
  return Object.entries(PLACEHOLDERS).reduce(
    (text, [placeholder, resolve]) => text.split(placeholder).join(resolve(business)),
    body,
  );
}

// Alias mantido por compatibilidade com o nome usado no contrato de testes (T004).
export const personalizeOutreachBody = applyOutreachPlaceholders;
