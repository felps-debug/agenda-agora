import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Wallet } from "lucide-react";
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

      <div className="mx-auto max-w-2xl rounded-2xl border-2 border-primary/70 bg-card p-6 shadow-[0_0_24px_-8px_hsl(var(--primary))]">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
          <Wallet className="size-3.5" /> Saldo disponível
        </p>
        <p className="font-display text-3xl font-bold text-primary">{formatPrice(available)}</p>
        <p className="mt-4 text-xs font-semibold uppercase text-muted-foreground">Saldo pendente</p>
        <p className="font-display text-3xl font-bold">{formatPrice(pending)}</p>
      </div>

      <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-muted-foreground">
        Todas as transações de sinal são intermediadas pelo Agenda Agora.
      </p>

      <div className="surface mx-auto mt-8 max-w-2xl p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <KeyRound className="size-5 text-primary" /> Chave PIX de saque
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
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

      <h2 className="mt-8 mb-3 text-lg font-bold">Últimos sinais</h2>
      {!list.length ? (
        <EmptyList text="Nenhum sinal recebido ainda." />
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id} className="surface flex flex-wrap items-center gap-4 p-4">
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
    </div>
  );
}
