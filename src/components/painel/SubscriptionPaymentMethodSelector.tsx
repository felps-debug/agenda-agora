export function SubscriptionPaymentMethodSelector() {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[#8b8e96]">
        Forma de pagamento
      </p>
      <div className="rounded-[10px] border border-[var(--c-2f83ff)]/60 bg-[var(--c-rgba-59-130-246-a0d1)] p-3">
        <span className="block text-[0.86rem] font-semibold text-white">PIX</span>
        <span className="block text-xs text-[#8b8e96]">Liberação imediata</span>
      </div>
    </div>
  );
}
