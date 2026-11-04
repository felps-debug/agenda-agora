import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, Check, Hourglass, Lock, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBusinessAccessCycle, setBusinessAccessDays } from "@/lib/lifecycle.functions";
import { formatPrice } from "@/lib/format";

const STAGES: Array<{ id: string; momento: string; oQueAparece: string }> = [
  {
    id: "amanha",
    momento: "1 dia antes",
    oQueAparece: "Popup verde junto ao sino: \"Passando pra lembrar que sua fatura vence amanhã! Clique aqui para renovar o pagamento.\"",
  },
  {
    id: "venceu_hoje",
    momento: "No dia do vencimento",
    oQueAparece: "Popup verde: \"Olá! 😊 Passando pra lembrar que sua fatura vence hoje! Clique aqui para renovar o pagamento.\" — ícone de balão com $",
  },
  {
    id: "atrasado",
    momento: "1 dia após",
    oQueAparece: "Popup vermelho: \"ATENÇÃO! 😲 Sua fatura do sistema venceu. Clique aqui para renovar e evite bloqueios!\" — triângulo vermelho",
  },
  {
    id: "urgente",
    momento: "2º e 3º dias após",
    oQueAparece: "Modal escuro central: \"⚠ Urgente! Ainda não identificamos seu pagamento. O funcionamento do sistema poderá parar a qualquer momento.\" — fechável, só aviso",
  },
  {
    id: "bloqueado",
    momento: "4º dia após",
    oQueAparece: "🔒 Painel travado na tela de assinaturas: sidebar inerte, fixo em Pagamentos até pagar",
  },
  {
    id: "ok",
    momento: "Fatura paga",
    oQueAparece: "Painel liberado, sem avisos — novo ciclo de 30 dias iniciado.",
  },
];

const STAGE_LABEL: Record<string, string> = {
  ok: "Fatura paga",
  amanha: "Vence amanhã",
  venceu_hoje: "Vence hoje",
  atrasado: "Atrasado (1 dia)",
  urgente: "Urgente (2º/3º dia)",
  bloqueado: "Bloqueado (4º dia+)",
};

const dateBR = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

/**
 * Aba "Ciclo de acesso" da ficha do estabelecimento (Painel 3 Master):
 * dias restantes, vencimento, estágio de aviso atual do Painel 2 e edição
 * dos dias de acesso pelo master — refletido em tempo real no painel do dono.
 */
export function AccessCyclePanel({ businessId }: { businessId: string }) {
  const queryClient = useQueryClient();
  const cycleFn = useServerFn(getBusinessAccessCycle);
  const setDaysFn = useServerFn(setBusinessAccessDays);
  const [addDays, setAddDays] = useState("30");
  const [addMotivo, setAddMotivo] = useState("");
  const [removeDays, setRemoveDays] = useState("7");
  const [removeMotivo, setRemoveMotivo] = useState("");

  const cycle = useQuery({
    queryKey: ["business-access-cycle", businessId],
    queryFn: () => cycleFn({ data: { businessId } }),
    refetchInterval: 30000,
  });

  const apply = useMutation({
    mutationFn: (input: {
      action: "adicionar" | "remover";
      days: number;
      motivo?: string | undefined;
    }) => setDaysFn({ data: { businessId, ...input } }),
    onSuccess: (result) => {
      toast.success(result.description || "Dias de acesso atualizados.");
      void queryClient.invalidateQueries({ queryKey: ["business-access-cycle", businessId] });
      void queryClient.invalidateQueries({ queryKey: ["master-business-dossier", businessId] });
      void queryClient.invalidateQueries({ queryKey: ["master-platform-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["subscription-lifecycle"] });
      void queryClient.invalidateQueries({ queryKey: ["receivables-calendar"] });
      setAddMotivo("");
      setRemoveMotivo("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (cycle.isPending) {
    return <p className="text-sm text-muted-foreground">Carregando ciclo de acesso…</p>;
  }
  if (cycle.isError || !cycle.data) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Não foi possível carregar o ciclo de acesso. Tente novamente.
      </p>
    );
  }

  const info = cycle.data;
  const isTrial = info.isTrial;
  const diasRestantes =
    info.category === "atencao"
      ? -Math.max(-info.daysLeft, 0)
      : Math.max(info.daysLeft, 0);
  const vencimento = info.accessUntil;
  const stage = info.stage;

  return (
    <div className="space-y-4">
      {/* Estado atual */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.07] bg-[#10151E] p-4">
          <p className="flex items-center gap-2 text-xs text-gray-400">
            <Hourglass className="size-4 text-[var(--c-69a2ff)]" /> Dias restantes
          </p>
          <p className={`mt-2 text-3xl font-bold ${diasRestantes < 0 ? "text-destructive" : "text-white"}`}>
            {diasRestantes}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {isTrial ? "dias de teste" : "dias até o próximo pagamento"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-[#10151E] p-4">
          <p className="flex items-center gap-2 text-xs text-gray-400">
            <CalendarClock className="size-4 text-[var(--c-69a2ff)]" /> Vencimento
          </p>
          <p className="mt-2 text-xl font-bold text-white">{dateBR(vencimento)}</p>
          <p className="mt-1 text-xs text-gray-500">
            {isTrial ? "fim do teste" : "próximo pagamento"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-[#10151E] p-4">
          <p className="text-xs text-gray-400">Situação</p>
          <p className="mt-2 text-sm font-bold text-white">
            {info.category === "em_teste"
              ? "Em teste"
              : info.category === "assinante"
                ? "Assinante"
                : (info.reasonLabel ?? "Atenção")}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {info.category === "assinante"
              ? "fatura do ciclo paga"
              : info.category === "em_teste"
                ? "período gratuito"
                : "exige ação"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-[#10151E] p-4">
          <p className="text-xs text-gray-400">Valor da assinatura</p>
          <p className="mt-2 text-xl font-bold text-white">{formatPrice(info.amountCents)}/mês</p>
          <p className="mt-1 text-xs text-gray-500">ciclo mensal</p>
        </div>
      </div>

      {/* Momento atual do Painel 2 */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0D1119] p-4">
        <p className="text-sm font-semibold text-[var(--c-eef1f6)]">
          Momento atual do Painel 2 do dono:{" "}
          <span className={stage === "ok" ? "text-emerald-400" : "text-amber-400"}>
            {STAGE_LABEL[stage] ?? stage}
          </span>
        </p>
        <ul className="mt-3 space-y-2">
          {STAGES.map((item) => {
            const current = item.id === stage;
            return (
              <li
                key={item.id}
                className={`flex items-start gap-3 rounded-lg border p-2.5 text-sm ${
                  current
                    ? "border-[var(--c-1677ff)]/40 bg-[var(--c-1677ff)]/[0.08]"
                    : "border-white/[0.05] bg-black/20 opacity-70"
                }`}
              >
                <span
                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${
                    current ? "bg-[var(--c-1677ff)] text-white" : "border border-white/20"
                  }`}
                >
                  {current ? <Check className="size-3" /> : null}
                </span>
                <span className="min-w-0">
                  <span className={`font-medium ${current ? "text-white" : "text-[#9aa1ab]"}`}>
                    {item.momento}
                  </span>
                  <span className="block text-xs leading-relaxed text-[#777d87]">
                    {item.oQueAparece}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        {stage === "bloqueado" ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-destructive">
            <Lock className="size-3.5" /> A conta está congelada na tela de assinaturas até o
            pagamento ser confirmado.
          </p>
        ) : null}
      </div>

      {/* Editor de dias — adicionar / remover */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Adicionar dias (verde) */}
        <div className="rounded-2xl border border-emerald-500/25 bg-[#0D1119] p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-400">
            <Plus className="size-4" /> Adicionar dias
          </p>
          <label className="mt-3 block text-xs font-medium text-gray-400">
            Dias
            <Input
              type="number"
              min={1}
              value={addDays}
              onChange={(event) => setAddDays(event.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="Ex.: 30"
              className="mt-1 border-white/10 bg-black/40 text-white"
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-gray-400">
            Motivo
            <Input
              value={addMotivo}
              onChange={(event) => setAddMotivo(event.target.value)}
              placeholder="Motivo da extensão..."
              className="mt-1 border-white/10 bg-black/40 text-white"
            />
          </label>
          <Button
            type="button"
            disabled={apply.isPending || Number(addDays) < 1}
            onClick={() =>
              apply.mutate({
                action: "adicionar",
                days: Math.max(Math.trunc(Number(addDays)), 1),
                motivo: addMotivo.trim() || undefined,
              })
            }
            className="mt-4 h-10 w-full rounded-xl bg-emerald-500 font-bold text-white transition-colors hover:bg-emerald-600"
          >
            {apply.isPending ? "Aplicando…" : "Adicionar dias"}
          </Button>
        </div>

        {/* Remover dias (vermelho) */}
        <div className="rounded-2xl border border-destructive/25 bg-[#0D1119] p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-red-400">
            <Minus className="size-4" /> Remover dias
          </p>
          <label className="mt-3 block text-xs font-medium text-gray-400">
            Dias
            <Input
              type="number"
              min={1}
              value={removeDays}
              onChange={(event) =>
                setRemoveDays(event.target.value.replace(/\D/g, "").slice(0, 5))
              }
              placeholder="Ex.: 7"
              className="mt-1 border-white/10 bg-black/40 text-white"
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-gray-400">
            Motivo
            <Input
              value={removeMotivo}
              onChange={(event) => setRemoveMotivo(event.target.value)}
              placeholder="Motivo da redução..."
              className="mt-1 border-white/10 bg-black/40 text-white"
            />
          </label>
          <Button
            type="button"
            disabled={apply.isPending || Number(removeDays) < 1}
            onClick={() =>
              apply.mutate({
                action: "remover",
                days: Math.max(Math.trunc(Number(removeDays)), 1),
                motivo: removeMotivo.trim() || undefined,
              })
            }
            className="mt-4 h-10 w-full rounded-xl bg-red-500 font-bold text-white transition-colors hover:bg-red-600"
          >
            Remover dias
          </Button>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-gray-500">
        {isTrial
          ? "Esta conta está em teste: os dias adicionados/removidos mudam o período gratuito restante. Remover tudo (0) expira agora."
          : "Assinante pagante: os dias deslocam o vencimento junto com a recorrência mensal. Remover mais dias do que restam antecipa o bloqueio."}
      </p>
      <p className="text-xs leading-relaxed text-gray-500">
        A alteração vale na hora: o painel do dono recalcula os avisos a cada carregamento e a
        cada virada de dia (1 dia antes → hoje → atrasado → urgente → bloqueio no 4º dia), sem
        intervenção manual.
      </p>
    </div>
  );
}
