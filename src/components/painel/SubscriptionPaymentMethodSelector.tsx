import { cardPaymentEnabled } from "@/lib/payment-methods";

export type SubscriptionPayMethod = "pix" | "card";

const OPTIONS: { id: SubscriptionPayMethod; label: string; hint: string }[] = [
  { id: "pix", label: "PIX", hint: "Liberação imediata" },
  { id: "card", label: "Cartão de crédito", hint: "Pagamento em ambiente seguro" },
];

/**
 * Escolha da forma de pagamento da assinatura. O cartão usa o checkout hospedado do AgPay:
 * nenhum dado de cartão é digitado nem trafega pelo nosso sistema.
 */
export function SubscriptionPaymentMethodSelector({
  value = "pix",
  onChange,
}: {
  value?: SubscriptionPayMethod;
  onChange?: (method: SubscriptionPayMethod) => void;
}) {
  const options = OPTIONS.filter((option) => option.id !== "card" || cardPaymentEnabled());
  return (
    <div className="mt-4">
      <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[#8b8e96]">
        Forma de pagamento
      </p>
      <div
        className={`grid gap-2 ${options.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
        role="radiogroup"
        aria-label="Forma de pagamento"
      >
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange?.(option.id)}
              className={`rounded-[10px] border p-3 text-left transition-colors ${
                selected
                  ? "border-[var(--c-2f83ff)]/60 bg-[var(--c-rgba-59-130-246-a0d1)]"
                  : "border-[var(--c-2a2e35)] bg-[var(--c-101218)] hover:border-white/30"
              }`}
            >
              <span className="block text-[0.86rem] font-semibold text-white">{option.label}</span>
              <span className="block text-xs text-[#8b8e96]">{option.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
