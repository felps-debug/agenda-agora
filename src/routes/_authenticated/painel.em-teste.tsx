import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FlaskConical, Plus } from "lucide-react";
import { friendlyError } from "@/lib/error-page";
import { createBusinessWithOwner } from "@/lib/admin.functions";
import { requireMasterAccess } from "@/lib/master.functions";
import { extendBusinessTrial, getSubscriptionLifecycle } from "@/lib/lifecycle.functions";
import { BusinessDossier } from "@/components/master/BusinessDossier";
import { TONE_AMBER } from "@/components/master/PlatformOverview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/painel/em-teste")({
  loader: () => (typeof window === "undefined" ? undefined : requireMasterAccess()),
  head: () => ({
    meta: [
      { title: "Em teste — Painel master" },
      { name: "description", content: "Contas de teste da plataforma." },
    ],
  }),
  component: EmTestePage,
});

const emptyForm = { businessName: "", category: "outro", ownerName: "", phone: "", password: "" };

const formatPhone = (value: string) => {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const dateBR = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

function relativeActivity(days: number | null) {
  if (days == null) return "Sem acesso";
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  return `Há ${days} dias`;
}

function EmTestePage() {
  const queryClient = useQueryClient();
  const lifecycleFn = useServerFn(getSubscriptionLifecycle);
  const createFn = useServerFn(createBusinessWithOwner);
  const extendFn = useServerFn(extendBusinessTrial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [trialDays, setTrialDays] = useState("7");
  const [registrationName, setRegistrationName] = useState("");
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const lifecycle = useQuery({
    queryKey: ["subscription-lifecycle"],
    queryFn: () => lifecycleFn(),
    refetchInterval: 60000,
  });
  const rows = (lifecycle.data?.items ?? []).filter((item) => item.category_ === "em_teste");

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          ...form,
          trialDays: Math.max(Number(trialDays) || 0, 0),
          registrationName: registrationName.trim() || undefined,
        },
      }),
    onSuccess: (result) => {
      toast.success(`Conta de teste criada. Senha inicial (mostrada uma vez): ${result.initialPassword}`);
      setOpen(false);
      setForm(emptyForm);
      setTrialDays("7");
      setRegistrationName("");
      void queryClient.invalidateQueries({ queryKey: ["subscription-lifecycle"] });
      void queryClient.invalidateQueries({ queryKey: ["master-platform-overview"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const extend = useMutation({
    mutationFn: (businessId: string) => extendFn({ data: { businessId, days: 7 } }),
    onSuccess: (result) => {
      toast.success(
        `Teste estendido por 7 dias — novo fim: ${new Date(result.trialEnd).toLocaleDateString("pt-BR")}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["subscription-lifecycle"] });
      void queryClient.invalidateQueries({ queryKey: ["master-platform-overview"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  return (
    <div className="master-skin mx-auto w-full p-4 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="report-icon-box report-icon-box-lg relative z-10"
          style={
            {
              "--report-icon-color": TONE_AMBER.color,
              "--report-icon-background": TONE_AMBER.background,
              "--report-icon-border": TONE_AMBER.border,
              "--report-icon-glow": TONE_AMBER.glow,
            } as React.CSSProperties
          }
        >
          <FlaskConical className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold">(Em teste)</h1>
          <p className="text-sm text-muted-foreground">
            Contas dentro do período gratuito — saem daqui automaticamente ao contratar ou ao
            encerrar o teste.
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link to="/painel/master">
            <Button variant="secondary">Voltar</Button>
          </Link>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Nova conta de teste
          </Button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto report-x-scroll rounded-xl border border-border bg-card report-luminous-card report-effect-strong">
        <table className="w-full min-w-[1020px] text-sm">
          <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Estabelecimento</th>
              <th className="px-4 py-3">Criada em</th>
              <th className="px-4 py-3">Fim do acesso</th>
              <th className="px-4 py-3">Dias restantes</th>
              <th className="px-4 py-3">Última atividade</th>
              <th className="px-4 py-3">Agendamentos</th>
              <th className="px-4 py-3">Configurações</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const daysLeft = item.trialDaysLeft ?? 0;
              return (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">
                    {item.name}
                    <span className="block text-xs text-muted-foreground">
                      {item.ownerName ?? "—"} · {item.ownerEmail ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{dateBR(item.createdAt)}</td>
                  <td className="px-4 py-3">{dateBR(item.accessUntil)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        daysLeft <= 1
                          ? "bg-destructive/15 text-destructive"
                          : daysLeft <= 3
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-emerald-500/15 text-emerald-400"
                      }`}
                    >
                      {daysLeft === 0
                        ? "Último dia"
                        : daysLeft === 1
                          ? "Falta 1 dia"
                          : `${daysLeft} dias`}
                    </span>
                  </td>
                  <td className="px-4 py-3">{relativeActivity(item.daysSinceLastAccess)}</td>
                  <td className="px-4 py-3">{item.appointmentsCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-[var(--c-1677ff)]"
                          style={{ width: `${item.setupPercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{item.setupPercent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={extend.isPending}
                        onClick={() => extend.mutate(item.id)}
                      >
                        Estender +7 dias
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setDetailsId(item.id)}>
                        Detalhes
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!lifecycle.isPending && !rows.length && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma conta em teste no momento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <BusinessDossier businessId={detailsId} onClose={() => setDetailsId(null)} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova conta de teste (Painel 2)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tname">Nome do comércio</Label>
              <Input
                id="tname"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                placeholder="Ex.: Studio Bella"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="treg">Nome para o cadastro (titular da conta mãe)</Label>
              <Input
                id="treg"
                value={registrationName}
                onChange={(e) => setRegistrationName(e.target.value)}
                placeholder="Ex.: Maria Eduarda Silva"
              />
              <p className="text-xs text-muted-foreground">
                Nome que constará no cadastro da conta. O Pix de saque precisará ser do mesmo titular.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="towner">Nome do dono</Label>
              <Input
                id="towner"
                value={form.ownerName}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                placeholder="Ex.: Juliana"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tphone">Usuário (telefone)</Label>
                <Input
                  id="tphone"
                  inputMode="numeric"
                  value={formatPhone(form.phone)}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 99999-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpass">Senha do painel</Label>
                <Input
                  id="tpass"
                  inputMode="numeric"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value.replace(/\D/g, "").slice(0, 4) })
                  }
                  placeholder="1234"
                  maxLength={4}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tdays">Dias de uso liberados</Label>
              <Input
                id="tdays"
                type="number"
                min={1}
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                placeholder="7"
              />
              <p className="text-xs text-muted-foreground">
                Período em que o dono poderá usar o painel com todas as funcionalidades.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => create.mutate()}
              disabled={
                create.isPending ||
                form.businessName.trim().length < 2 ||
                form.ownerName.trim().length < 2 ||
                form.phone.replace(/\D/g, "").length < 10 ||
                form.password.length !== 4
              }
            >
              Criar acesso de teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
