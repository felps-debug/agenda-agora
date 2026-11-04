import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { Info, Save, Settings } from "lucide-react";
import { requireMasterAccess } from "@/lib/master.functions";
import { getAgpayFees, saveAgpayFees } from "@/lib/agpay-fees.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/painel/carteira-config")({
  loader: () => (typeof window === "undefined" ? undefined : requireMasterAccess()),
  head: () => ({ meta: [{ title: "Configuração de taxas da carteira" }] }),
  component: PlatformFeesPage,
});

function PlatformFeesPage() {
  const queryClient = useQueryClient();
  const getFees = useServerFn(getAgpayFees);
  const saveFees = useServerFn(saveAgpayFees);
  const fees = useQuery({ queryKey: ["platform-fees"], queryFn: () => getFees() });
  const [depositFee, setDepositFee] = useState("0,75");
  const [withdrawFee, setWithdrawFee] = useState("3,00");
  useEffect(() => {
    if (!fees.data) return;
    setDepositFee((fees.data.deposit_fixed_cents / 100).toFixed(2).replace(".", ","));
    setWithdrawFee((fees.data.withdraw_fixed_cents / 100).toFixed(2).replace(".", ","));
  }, [fees.data]);
  const mutation = useMutation({
    mutationFn: () => {
      const deposit = Number(depositFee.replace(",", "."));
      const withdraw = Number(withdrawFee.replace(",", "."));
      if (!Number.isFinite(deposit) || !Number.isFinite(withdraw) || deposit < 0 || withdraw < 0) {
        throw new Error("Informe valores válidos, iguais ou maiores que zero.");
      }
      return saveFees({
        data: {
          deposit_fixed_cents: Math.round(deposit * 100),
          withdraw_fixed_cents: Math.round(withdraw * 100),
        },
      });
    },
    onSuccess: async () => {
      toast.success("Referências salvas.");
      await queryClient.invalidateQueries({ queryKey: ["platform-fees"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const fieldClass =
    "w-full rounded-xl border border-slate-700 bg-[#07080b] px-4 py-3 text-sm font-bold text-white outline-none focus:border-purple-500";

  return (
    <div className="min-h-screen bg-[#07080b] p-6 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center gap-3 border-b border-slate-800/80 pb-4">
          <span className="flex size-10 items-center justify-center rounded-xl border border-purple-800/50 bg-[#1d1836] text-purple-400">
            <Settings className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold uppercase tracking-wide">Taxas da carteira</h1>
            <p className="text-xs text-gray-400">Valores de referência usados em simulações.</p>
          </div>
        </header>
        {fees.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível carregar as configurações.
          </p>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
          className="space-y-5 rounded-2xl border border-slate-800/80 bg-[#0c0d12] p-6"
        >
          <label className="block space-y-2 text-xs font-bold uppercase tracking-wider text-gray-300">
            Referência de taxa por sinal (R$)
            <input
              className={fieldClass}
              inputMode="decimal"
              value={depositFee}
              onChange={(event) => setDepositFee(event.target.value)}
            />
          </label>
          <label className="block space-y-2 text-xs font-bold uppercase tracking-wider text-gray-300">
            Referência de taxa por saque (R$)
            <input
              className={fieldClass}
              inputMode="decimal"
              value={withdrawFee}
              onChange={(event) => setWithdrawFee(event.target.value)}
            />
          </label>
          <div className="flex items-start gap-2 rounded-lg border border-blue-900/60 bg-blue-950/30 p-3 text-xs text-blue-100">
            <Info className="mt-0.5 size-4 shrink-0" /> Estes valores são simulações. Receita e
            custos realizados são calculados com os valores gravados no ledger.
          </div>
          <button
            disabled={mutation.isPending || fees.isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-purple-500 disabled:opacity-50"
          >
            <Save className="size-4" />
            {mutation.isPending ? "Salvando…" : "Salvar referências"}
          </button>
        </form>
      </div>
    </div>
  );
}
