import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CircleDollarSign, Clock3, History, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { formatPrice, formatTime } from "@/lib/format";
import { saveWithdrawalPixKey, withdrawalPixKeyTypes } from "@/lib/withdrawal.functions";
import { PageHeader, NoBusiness, EmptyList } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type WithdrawalPixKeyType = (typeof withdrawalPixKeyTypes)[number];

const pixKeyTypeLabel: Record<WithdrawalPixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  aleatoria: "Chave aleatória",
};

export const Route = createFileRoute("/_authenticated/painel/as-pay")({
  head: () => ({
    meta: [
      { title: "AS Pay — Agenda Agora" },
      { name: "description", content: "Saldo dos sinais pagos pelos clientes para agendar." },
      { property: "og:title", content: "AS Pay — Agenda Agora" },
      { property: "og:description", content: "Saldo dos sinais pagos pelos clientes." },
    ],
  }),
  component: AsPayPage,
});

function AsPayPage() {
  const { businessId, business } = useBusiness();
  const queryClient = useQueryClient();
  const saveWithdrawalPixKeyFn = useServerFn(saveWithdrawalPixKey);

  const { data: rows } = useQuery({
    queryKey: ["as-pay", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, customer_name, starts_at, deposit_cents, deposit_paid_at, status")
        .eq("business_id", businessId!)
        .gt("deposit_cents", 0)
        .order("starts_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: withdrawalPixKey } = useQuery({
    queryKey: ["withdrawal-pix-key", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("withdrawal_pix_key, withdrawal_pix_key_type")
        .eq("id", businessId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<WithdrawalPixKeyType>("telefone");

  useEffect(() => {
    setPixKey(withdrawalPixKey?.withdrawal_pix_key ?? "");
    setPixKeyType(
      (withdrawalPixKey?.withdrawal_pix_key_type as WithdrawalPixKeyType) ?? "telefone",
    );
  }, [withdrawalPixKey]);

  const savePixKey = useMutation({
    mutationFn: () =>
      saveWithdrawalPixKeyFn({
        data: { businessId: businessId!, pixKey: pixKey.trim(), pixKeyType },
      }),
    onSuccess: () => {
      toast.success("Chave PIX de saque salva.");
      void queryClient.invalidateQueries({ queryKey: ["withdrawal-pix-key", businessId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!businessId) return <NoBusiness />;

  const list = rows ?? [];
  const available = list
    .filter((r) => r.deposit_paid_at && r.status !== "cancelado")
    .reduce((sum, r) => sum + r.deposit_cents, 0);
  const pending = list
    .filter((r) => !r.deposit_paid_at && r.status !== "cancelado")
    .reduce((sum, r) => sum + r.deposit_cents, 0);

  return (
    <div>
      <PageHeader
        title="Sua carteira"
        subtitle={`Sinais pagos pelos clientes de ${business?.name ?? "seu negócio"}.`}
      />

      <div className="report-luminous-card report-effect-strong mx-auto max-w-2xl p-6">
        <div className="relative z-10 space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.18)]">
              <CircleDollarSign className="size-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Saldo disponível
              </p>
              <p className="font-display text-3xl font-bold text-primary">
                {formatPrice(available)}
              </p>
            </div>
          </div>

          <div className="h-px w-full bg-white/10" />

          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.18)]">
              <Clock3 className="size-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Saldo pendente
              </p>
              <p className="font-display text-3xl font-bold">{formatPrice(pending)}</p>
            </div>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-muted-foreground">
        Todas as transações de sinal são intermediadas pelo Agenda Agora.
      </p>

      <section className="report-luminous-card report-effect-medium as-pay-card mx-auto mt-8 max-w-2xl p-4 sm:p-5">
        <div className="relative z-10">
          <div className="as-pay-section-title">
            <KeyRound aria-hidden="true" />
            <h2>Chave PIX de saque</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Cadastre a chave para onde os saques do seu saldo devem ser enviados.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pix-key-type">Tipo de chave</Label>
              <select
                id="pix-key-type"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={pixKeyType}
                onChange={(e) => setPixKeyType(e.target.value as WithdrawalPixKeyType)}
              >
                {withdrawalPixKeyTypes.map((type) => (
                  <option key={type} value={type}>
                    {pixKeyTypeLabel[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pix-key">Chave PIX</Label>
              <Input
                id="pix-key"
                placeholder="Sua chave PIX"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
              />
            </div>
          </div>

          <Button
            className="mt-4"
            disabled={!pixKey.trim() || savePixKey.isPending}
            onClick={() => savePixKey.mutate()}
          >
            Salvar chave PIX
          </Button>
        </div>
      </section>

      <section className="report-luminous-card report-effect-none as-pay-card as-pay-history-card mx-auto mt-3 max-w-2xl">
        <div className="as-pay-history-header relative z-10">
          <h2 className="flex items-center gap-2">
            <History className="size-[0.9rem] text-[#5d6570]" aria-hidden="true" />
            Últimos sinais
          </h2>
          <p>Sinais pagos e pendentes das reservas</p>
        </div>
        {!list.length ? (
          <div className="relative z-10 p-4">
            <EmptyList text="Nenhum sinal recebido ainda." />
          </div>
        ) : (
          <ul className="relative z-10 divide-y divide-white/[0.065]">
            {list.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                <div className="flex-1">
                  <p className="font-semibold">{r.customer_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(r.starts_at).toLocaleDateString("pt-BR")} · {formatTime(r.starts_at)}
                  </p>
                </div>
                <span className="font-semibold">{formatPrice(r.deposit_cents)}</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    r.deposit_paid_at
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.deposit_paid_at ? "Pago" : "Pendente"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
