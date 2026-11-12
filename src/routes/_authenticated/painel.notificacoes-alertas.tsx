import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import SecurityPinModal from "@/components/painel/SecurityPinModal";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Check, Hourglass, MailOpen, Plus, Users } from "lucide-react";
import { requireMasterAccess } from "@/lib/master.functions";
import { createBroadcast, deleteBroadcast, listBroadcasts } from "@/lib/broadcasts.functions";
import { TONE_BLUE } from "@/components/master/PlatformOverview";
import {
  BROADCAST_ACCENT_OPTIONS,
  BROADCAST_AUDIENCES,
  BROADCAST_DEFAULT_ACCENT,
  BROADCAST_DEFAULT_DAYS,
  BROADCAST_DEFAULT_ICON_KEY,
  BROADCAST_MAX_DAYS,
  broadcastAudienceDescription,
  broadcastAudienceLabel,
  broadcastAudiencesCompact,
  isBroadcastExpired,
  type BroadcastAudience,
} from "@/lib/broadcast";
import { BROADCAST_ICON_OPTIONS, broadcastIconOption } from "@/components/painel/BroadcastIcon";
import { AvisoPop } from "@/components/painel/AvisoPop";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/painel/notificacoes-alertas")({
  loader: () => (typeof window === "undefined" ? undefined : requireMasterAccess()),
  head: () => ({
    meta: [
      { title: "Notificações e alertas — Painel master" },
      { name: "description", content: "Envie notificações para todos os usuários." },
    ],
  }),
  component: NotificacoesAlertasPage,
});

function NotificacoesAlertasPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listBroadcasts);
  const createFn = useServerFn(createBroadcast);
  const deleteFn = useServerFn(deleteBroadcast);

  const [authorized, setAuthorized] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      return window.sessionStorage.getItem("agenda-agora:notif-auth") === "1";
    } catch {
      return false;
    }
  });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audiences, setAudiences] = useState<string[]>(["todos"]);
  const [displayDays, setDisplayDays] = useState(BROADCAST_DEFAULT_DAYS);
  const [accent, setAccent] = useState(BROADCAST_DEFAULT_ACCENT);
  const [iconKey, setIconKey] = useState<string>(BROADCAST_DEFAULT_ICON_KEY);
  const PreviewIcon = broadcastIconOption(iconKey).Icon;

  /** Marca/desmarca público-alvo: "todos" e os específicos se excluem; coleta vazia volta a "todos". */
  const toggleAudience = (value: BroadcastAudience) => {
    setAudiences((current) => {
      if (value === "todos") {
        if (current.includes("todos")) return current;
        return ["todos"];
      }
      const withoutTodos = current.filter((a) => a !== "todos");
      const next = withoutTodos.includes(value)
        ? withoutTodos.filter((a) => a !== value)
        : [...withoutTodos, value];
      return next.length ? next : ["todos"];
    });
  };

  /* Rótulo amigável do público selecionado. */
  const audienceSummary = audiences.includes("todos")
    ? broadcastAudienceLabel.todos
    : audiences.map((a) => broadcastAudienceLabel[a as BroadcastAudience]).join(" + ");

  const { data: list = [] } = useQuery({
    queryKey: ["broadcasts"],
    queryFn: () => listFn(),
  });

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          title: title.trim(),
          message: message.trim(),
          audiences,
          displayDays,
          accentColor: accent,
          icon: iconKey,
        },
      }),
    onSuccess: () => {
      toast.success(`Notificação enviada para ${audienceSummary.toLowerCase()}!`);
      setOpen(false);
      setTitle("");
      setMessage("");
      setAudiences(["todos"]);
      setDisplayDays(BROADCAST_DEFAULT_DAYS);
      setAccent(BROADCAST_DEFAULT_ACCENT);
      setIconKey(BROADCAST_DEFAULT_ICON_KEY);
      void queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Notificação removida.");
      void queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!authorized) {
    return (
      <>
        <div className="mx-auto w-full p-4 sm:p-8">
          <p className="text-sm text-muted-foreground">
            Acesso protegido. Digite o PIN para continuar.
          </p>
        </div>
        <SecurityPinModal
          isOpen={true}
          onClose={() => void navigate({ to: "/painel/master" })}
          onSuccess={() => {
            setAuthorized(true);
            try {
              window.sessionStorage.setItem("agenda-agora:notif-auth", "1");
            } catch {
              // Ignora falhas de armazenamento.
            }
          }}
        />
      </>
    );
  }

  return (
    <div className="master-skin mx-auto w-full p-4 sm:p-8">
      <div className="flex flex-wrap items-center gap-4">
        <span
          className="report-icon-box report-icon-box-lg relative z-10"
          style={
            {
              "--report-icon-color": TONE_BLUE.color,
              "--report-icon-background": TONE_BLUE.background,
              "--report-icon-border": TONE_BLUE.border,
              "--report-icon-glow": TONE_BLUE.glow,
            } as React.CSSProperties
          }
        >
          <BellRing className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold uppercase tracking-tight">
            Notificações e Alertas
          </h1>
          <p className="text-sm text-muted-foreground">
            Envie avisos para todos os usuários cadastrados — assinantes ou em teste.
          </p>
        </div>
        <Button
          size="lg"
          className="font-extrabold uppercase tracking-wide"
          onClick={() => setOpen(true)}
        >
          <Plus className="size-4" /> Nova notificação
        </Button>
      </div>

      <section className="mt-6 overflow-x-auto report-x-scroll rounded-2xl border border-border bg-card report-luminous-card report-effect-strong">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 w-1/5">Título</th>
              <th className="px-4 py-3">Mensagem</th>
              <th className="px-4 py-3 w-44">Público</th>
              <th className="px-4 py-3 w-40">Status</th>
              <th className="px-4 py-3 w-32">Data de envio</th>
              <th className="px-4 py-3 w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {!list.length && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground">
                    <MailOpen className="size-5" />
                  </span>
                  <p className="mt-4 text-lg font-extrabold">Nenhuma notificação enviada</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Crie a primeira notificação para comunicar com todos os usuários do sistema.
                  </p>
                  <Button
                    className="mt-5 font-extrabold uppercase tracking-wide"
                    onClick={() => setOpen(true)}
                  >
                    Criar primeira notificação
                  </Button>
                </td>
              </tr>
            )}
            {list.map((b) => {
              const expirada = isBroadcastExpired(b);
              const diasRestantes = Math.max(
                0,
                Math.ceil(
                  (new Date(b.createdAt).getTime() +
                    (b.displayDays ?? BROADCAST_DEFAULT_DAYS) * 86_400_000 -
                    Date.now()) /
                    86_400_000,
                ),
              );
              return (
                <tr key={b.id} className="border-t border-border">
                  <td className="px-4 py-3 font-semibold">{b.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b.message}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-xs font-bold text-blue-300">
                      <Users className="size-3" /> {broadcastAudiencesCompact(b)}
                    </span>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Exibição: {b.displayDays ?? BROADCAST_DEFAULT_DAYS}{" "}
                      {(b.displayDays ?? BROADCAST_DEFAULT_DAYS) === 1 ? "dia" : "dias"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {expirada ? (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-muted-foreground">
                        Expirada
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400">
                        Ativa · {diasRestantes} {diasRestantes === 1 ? "dia rest." : "dias rest."}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(b.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="rounded-lg bg-destructive/15 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/25"
                      onClick={() => remove.mutate(b.id)}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[99vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova notificação</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 lg:grid-cols-[1fr_minmax(280px,360px)]">
            {/* Formulário */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ntitle">Título</Label>
                <Input
                  id="ntitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Atualização importante"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nmsg">Mensagem</Label>
                <Textarea
                  id="nmsg"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ex.: Nosso sistema terá manutenção às 02h. Obrigado por usar o Agenda Agora! 💙"
                />
              </div>

              {/* Público-alvo: quem recebe a notificação no painel 2 */}
              <div className="space-y-2">
                <Label>Enviar para quem?</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {BROADCAST_AUDIENCES.map((value) => {
                    const checked = audiences.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleAudience(value)}
                        className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                          checked
                            ? "border-blue-500/60 bg-blue-500/10"
                            : "border-border bg-card hover:border-blue-500/30"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-md border ${
                            checked
                              ? "border-blue-400 bg-blue-500 text-white"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {checked ? <Check className="size-3" strokeWidth={3} /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block break-words text-sm font-bold leading-tight">
                            {broadcastAudienceLabel[value]}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                            {broadcastAudienceDescription[value]}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dias de exibição na caixa de notificações do painel 2 */}
              <div className="space-y-2">
                <Label htmlFor="ndays">
                  Quantos dias fica na caixa de notificações do painel 2?
                </Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {Array.from({ length: BROADCAST_MAX_DAYS }, (_, i) => i + 1).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDisplayDays(d)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-extrabold transition-colors ${
                        displayDays === d
                          ? "border-blue-500/70 bg-blue-500/15 text-blue-300"
                          : "border-border bg-card text-muted-foreground hover:border-blue-500/30"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
                <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                  <Hourglass className="mt-0.5 size-3.5 shrink-0" />
                  Depois desse prazo a mensagem sai sozinha da caixa de notificações do
                  estabelecimento (máximo de 7 dias).
                </p>
              </div>

              {/* Cor de destaque do pop-up (só a cor e os efeitos mudam) */}
              <div className="space-y-2">
                <Label>Cor do pop-up</Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {BROADCAST_ACCENT_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-label={`Cor ${option}`}
                      onClick={() => setAccent(option)}
                      className={`size-7 rounded-full border-2 transition-transform ${
                        accent.toLowerCase() === option
                          ? "scale-110 border-white/80"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: option, boxShadow: `0 0 10px ${option}66` }}
                    />
                  ))}
                  {/* Cor livre: seletor nativo */}
                  <label
                    className="relative flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/50"
                    style={{ backgroundColor: accent, boxShadow: `0 0 10px ${accent}66` }}
                    title="Escolher outra cor"
                  >
                    <input
                      type="color"
                      value={accent}
                      onChange={(e) => setAccent(e.target.value)}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </label>
                  <span className="font-mono text-[11px] uppercase text-muted-foreground">
                    {accent}
                  </span>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Muda apenas a cor e os efeitos do pop-up no painel 2 — estrutura e texto ficam
                  iguais.
                </p>
              </div>

              {/* Ícone do pop-up */}
              <div className="space-y-2">
                <Label>Ícone do pop-up</Label>
                <div className="flex flex-wrap gap-1.5">
                  {BROADCAST_ICON_OPTIONS.map(({ key, label, Icon }) => {
                    const checked = iconKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        title={label}
                        onClick={() => setIconKey(key)}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                          checked
                            ? "border-blue-500/70 bg-blue-500/15 text-blue-300"
                            : "border-border bg-card text-muted-foreground hover:border-blue-500/30"
                        }`}
                      >
                        <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Preview: como a notificação chega no painel 2 do dono */}
            <div className="space-y-3">
              <div className="rounded-xl border border-[#25282c] bg-[#0b0c10] p-3 aa-broadcast-preview">
                <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#626872]">
                  Como chega no painel 2
                </p>
                <div className="relative min-h-[110px] py-4">
                  <AvisoPop
                    accent={accent}
                    icon={<PreviewIcon strokeWidth={1.8} aria-hidden="true" />}
                    title={title || "Título da notificação"}
                    onClose={() => {}}
                  >
                    <p>
                      {message ||
                        "Escreva a mensagem e veja aqui exatamente como o dono vai receber."}
                    </p>
                  </AvisoPop>
                </div>
              </div>
              <div className="rounded-xl border border-[#25282c] bg-[#0b0c10] p-3">
                <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#626872]">
                  Caixa de notificações (sino)
                </p>
                <div className="rounded-lg border border-[var(--c-1f232b,#1f232b)] bg-[#12141a] p-3">
                  <p className="text-sm font-semibold text-[#f3f4f6]">
                    {title || "Título da notificação"}
                  </p>
                  <p className="mt-0.5 text-xs text-[#9ca3af]">
                    {message || "A prévia da mensagem aparece aqui."}
                  </p>
                  <p className="mt-1 text-[10px] text-[#626872]">
                    agora mesmo · {displayDays} {displayDays === 1 ? "dia" : "dias"} de exibição
                  </p>
                </div>
              </div>
              <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                <BellRing className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Destinatário: <strong className="font-bold">{audienceSummary}</strong>. A
                  notificação aparece no sino do painel 2 do estabelecimento.
                </span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => create.mutate()}
              disabled={!title.trim() || !message.trim() || create.isPending}
            >
              {create.isPending
                ? "Enviando…"
                : `Enviar para ${audiences.includes("todos") ? broadcastAudienceLabel.todos.toLowerCase() : audienceSummary.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
