import { useEffect, useState } from "react";
import { friendlyError } from "@/lib/error-page";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CircleDollarSign, Clock3, History, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { formatPrice } from "@/lib/format";
import { getLedgerStatement } from "@/lib/ledger.functions";
import {
  getWithdrawalPixKeyValidationError,
  requestWithdrawal,
  saveWithdrawalPixKey,
  withdrawalPixKeyTypes,
} from "@/lib/withdrawal.functions";
import { PageHeader, NoBusiness } from "@/components/painel/PageHeader";
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
  const getLedgerStatementFn = useServerFn(getLedgerStatement);
  const requestWithdrawalFn = useServerFn(requestWithdrawal);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");

  const {
    data: statement,
    isLoading: statementLoading,
    error: statementError,
  } = useQuery({
    queryKey: ["wallet-statement", businessId],
    enabled: !!businessId,
    queryFn: () => getLedgerStatementFn({ data: { businessId: businessId! } }),
  });

  const withdraw = useMutation({
    mutationFn: () =>
      requestWithdrawalFn({
        data: {
          businessId: businessId!,
          amountCents: Math.round(Number(withdrawalAmount.replace(",", ".")) * 100),
          idempotencyKey: crypto.randomUUID(),
        },
      }),
    onSuccess: ({ withdrawal }) => {
      setWithdrawalAmount("");
      toast.success(
        withdrawal?.status === "paid"
          ? "Saque concluído via Pix."
          : "Saque enviado para processamento. Aguarde a confirmação do Pix.",
      );
      void queryClient.invalidateQueries({ queryKey: ["wallet-statement", businessId] });
    },
    onError: (error: Error) => toast.error(friendlyError(error)),
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
  const pixKeyError = pixKey.trim() ? getWithdrawalPixKeyValidationError(pixKeyType, pixKey) : null;

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
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  if (!businessId) return <NoBusiness />;

  const available = statement?.availableCents ?? 0;
  const pending = statement?.pendingChargesCents ?? 0;
  const locked = statement?.lockedCents ?? 0;

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
                {statementLoading ? "Carregando…" : formatPrice(available)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-500/25 bg-sky-500/10 text-sky-400">
              <History className="size-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Total recebido
              </p>
              <p className="font-display text-2xl font-bold">
                {statementLoading ? "Carregando…" : formatPrice(statement?.totalReceivedCents ?? 0)}
              </p>
            </div>
          </div>

          {locked > 0 && (
            <p className="text-sm text-muted-foreground">
              Em saque (aguardando confirmação do Pix): {formatPrice(locked)}
            </p>
          )}
          {statement?.withdrawalsBlocked && (
            <p role="alert" className="text-sm text-amber-300">
              Seu saldo está negativo por um estorno. Novos saques ficam bloqueados até a revisão do
              administrador.
            </p>
          )}

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
                aria-invalid={!!pixKeyError}
                aria-describedby={pixKeyError ? "pix-key-error" : undefined}
              />
              {pixKeyError && (
                <p id="pix-key-error" role="alert" className="text-sm text-destructive">
                  {pixKeyError}
                </p>
              )}
            </div>
          </div>

          <Button
            className="mt-4"
            disabled={!pixKey.trim() || !!pixKeyError || savePixKey.isPending}
            onClick={() => savePixKey.mutate()}
          >
            Salvar chave PIX
          </Button>
        </div>
      </section>

      <section className="report-luminous-card report-effect-medium as-pay-card mx-auto mt-3 max-w-2xl p-4 sm:p-5">
        <div className="relative z-10">
          <h2 className="font-semibold">Solicitar saque</h2>
          <p className="mt-1 text-sm text-muted-foreground">Saque mínimo de R$ 13,00.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 space-y-2">
              <Label htmlFor="withdrawal-amount">Valor em reais</Label>
              <Input
                id="withdrawal-amount"
                inputMode="decimal"
                placeholder="13,00"
                value={withdrawalAmount}
                onChange={(event) => setWithdrawalAmount(event.target.value)}
              />
            </div>
            <Button
              className="self-end"
              disabled={
                withdraw.isPending ||
                !withdrawalPixKey?.withdrawal_pix_key ||
                Number(withdrawalAmount.replace(",", ".")) < 13
              }
              onClick={() => withdraw.mutate()}
            >
              {withdraw.isPending ? "Solicitando…" : "Sacar via Pix"}
            </Button>
          </div>
          {!withdrawalPixKey?.withdrawal_pix_key && (
            <p className="mt-2 text-sm text-amber-300">
              Cadastre uma chave Pix para solicitar saques.
            </p>
          )}
          {statementError && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              Não foi possível carregar o extrato. Tente novamente.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
