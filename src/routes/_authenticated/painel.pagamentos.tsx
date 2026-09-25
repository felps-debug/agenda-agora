import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { formatPrice } from "@/lib/format";
import { PageHeader, NoBusiness, EmptyList } from "@/components/painel/PageHeader";

export const Route = createFileRoute("/_authenticated/painel/pagamentos")({
  head: () => ({
    meta: [
      { title: "Pagamentos — Agenda Agora" },
      { name: "description", content: "Meses em que a assinatura da agenda foi paga." },
      { property: "og:title", content: "Pagamentos — Agenda Agora" },
      { property: "og:description", content: "Histórico de pagamentos da assinatura." },
    ],
  }),
  component: PagamentosPage,
});

function PagamentosPage() {
  const { businessId } = useBusiness();

  const { data: payments } = useQuery({
    queryKey: ["subscription_payments", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("business_id", businessId!)
        .order("reference_month", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!businessId) return <NoBusiness />;

  return (
    <div>
      <PageHeader title="Pagamentos" subtitle="Meses da assinatura mensal do seu painel." />

      {!payments?.length ? (
        <EmptyList text="Nenhum pagamento de assinatura registrado ainda." />
      ) : (
        <ul className="mx-auto max-w-xl space-y-3">
          {payments.map((p) => {
            const paid = p.status === "pago";
            const [y, m] = p.reference_month.split("-");
            return (
              <li
                key={p.id}
                className={`flex items-center justify-between rounded-xl border px-5 py-4 text-sm font-semibold ${
                  paid
                    ? "border-primary/60 bg-primary/20 text-primary"
                    : "border-destructive/50 bg-destructive/15 text-destructive-foreground"
                }`}
              >
                <span>
                  {m}/{y?.slice(2)}
                </span>
                <span>{formatPrice(p.amount_cents)}</span>
                <span>{paid ? "Pago" : "Em aberto"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
