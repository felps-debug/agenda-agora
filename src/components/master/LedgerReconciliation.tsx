import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatPrice } from "@/lib/format";
import {
  getLedgerReconciliation,
  listNegativeBalanceBusinesses,
  listStuckWithdrawals,
} from "@/lib/admin.functions";

function Total({ label, cents, hint }: { label: string; cents: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold">{formatPrice(cents)}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function LedgerReconciliation() {
  const totalsFn = useServerFn(getLedgerReconciliation);
  const stuckFn = useServerFn(listStuckWithdrawals);
  const negativeFn = useServerFn(listNegativeBalanceBusinesses);

  const totals = useQuery({ queryKey: ["ledger-reconciliation"], queryFn: () => totalsFn() });
  const stuck = useQuery({ queryKey: ["ledger-stuck-withdrawals"], queryFn: () => stuckFn() });
  const negative = useQuery({
    queryKey: ["ledger-negative-balances"],
    queryFn: () => negativeFn(),
  });

  if (totals.isLoading || stuck.isLoading || negative.isLoading)
    return <p className="p-4 text-sm text-muted-foreground">Carregando conciliação…</p>;
  if (totals.isError || stuck.isError || negative.isError || !totals.data)
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        Não foi possível carregar a conciliação financeira.
      </p>
    );

  const { availableCents, pendingCents, lockedCents, platformRevenueCents } = totals.data;
  const owedToBusinesses = availableCents + pendingCents + lockedCents;
  const stuckRows = stuck.data ?? [];
  const negativeRows = negative.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Total
            label="Devido aos negócios"
            cents={owedToBusinesses}
            hint="Disponível + bloqueado"
          />
          <Total label="Disponível para saque" cents={availableCents} />
          <Total label="Em saque" cents={lockedCents} hint="Aguardando confirmação do Pix" />
          <Total label="Receita da plataforma" cents={platformRevenueCents} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Confira manualmente: <strong>devido aos negócios + receita da plataforma</strong> não deve
          ultrapassar o saldo real da conta no AgPay. A comparação é manual porque o AgPay não expõe
          o saldo da conta por API.
        </p>
      </div>

      <section aria-labelledby="stuck-withdrawals-title">
        <h3 id="stuck-withdrawals-title" className="mb-2 font-semibold">
          Saques presos há mais de 24 horas
        </h3>
        {stuckRows.length ? (
          <ul className="divide-y divide-border rounded-xl border border-border text-sm">
            {stuckRows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="font-medium">{formatPrice(row.amount_cents)}</span>
                <span className="text-muted-foreground">
                  sem retorno desde {new Date(row.updated_at).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum saque preso.</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Resolva na lista de saques abaixo com “Marcar pago” ou “Marcar falha”; o saldo é acertado
          automaticamente.
        </p>
      </section>

      <section aria-labelledby="negative-balances-title">
        <h3 id="negative-balances-title" className="mb-2 font-semibold">
          Negócios com saldo negativo (saques bloqueados)
        </h3>
        {negativeRows.length ? (
          <ul className="divide-y divide-border rounded-xl border border-border text-sm">
            {negativeRows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="font-medium">{row.name}</span>
                <span className="text-destructive">{formatPrice(row.available_cents)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum negócio com saldo negativo.</p>
        )}
      </section>
    </div>
  );
}
