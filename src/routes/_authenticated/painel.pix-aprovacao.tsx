import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import SecurityPinModal from "@/components/painel/SecurityPinModal";
import {
  ShieldCheck,
  FileText,
  Eye,
  ArrowLeft,
  Phone,
  KeyRound,
  Pencil,
  X,
} from "lucide-react";
import { requireMasterAccess } from "@/lib/master.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listPixKeyApprovals,
  setPixKeyApprovalStatus,
  updatePixKeyApprovalEntry,
  updateBusinessTransferPin,
} from "@/lib/pix-approvals.functions";
import { withdrawalPixKeyTypes } from "@/lib/withdrawal.functions";
import { maskPixKey } from "@/lib/pix-key-format";
import { TONE_VIOLET } from "@/components/master/PlatformOverview";
import { toast } from "sonner";
import { formatPhoneBR } from "@/lib/format-phone";

export const Route = createFileRoute("/_authenticated/painel/pix-aprovacao")({
  loader: () => (typeof window === "undefined" ? undefined : requireMasterAccess()),
  head: () => ({
    meta: [
      { title: "Pix em aprovação — Painel master" },
      { name: "description", content: "Aprove chaves Pix vinculadas à conta mãe." },
    ],
  }),
  component: PixAprovacaoPage,
});

const keyTypeLabel: Record<string, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  aleatoria: "Chave aleatória",
};

const keyTypeHint: Record<string, string> = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
  email: "seu@email.com",
  telefone: "(00)00000-0000",
  aleatoria: "xxxxxxxx-xxxx-…",
};

function PixAprovacaoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listPixKeyApprovals);
  const statusFn = useServerFn(setPixKeyApprovalStatus);
  const editKeyFn = useServerFn(updatePixKeyApprovalEntry);
  const editPinFn = useServerFn(updateBusinessTransferPin);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Lápis: edição flexível da chave Pix (tipo + pontuação) e da senha pelo master.
  const [editKeyOpen, setEditKeyOpen] = useState(false);
  const [editKeyType, setEditKeyType] = useState<string>("cpf");
  const [editKeyValue, setEditKeyValue] = useState("");
  const [editKeySaving, setEditKeySaving] = useState(false);
  const [editPinOpen, setEditPinOpen] = useState(false);
  const [editPinValue, setEditPinValue] = useState("");
  const [editPinSaving, setEditPinSaving] = useState(false);
  const [authorized, setAuthorized] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      const validUntil = Number(window.sessionStorage.getItem("agenda-agora:security-pin-valid-until") ?? 0);
      return validUntil > Date.now();
    } catch {
      return false;
    }
  });
  const { data: list = [] } = useQuery({
    queryKey: ["pix-key-approvals"],
    queryFn: () => listFn(),
  });
  const decide = (id: string, status: "aprovado" | "recusado") => {
    statusFn({ data: { id, status } })
      .then(() => {
        toast.success(status === "aprovado" ? "Chave Pix aprovada." : "Chave Pix recusada.");
        setSelectedId(null);
        void queryClient.invalidateQueries({ queryKey: ["pix-key-approvals"] });
      })
      .catch((e: Error) => toast.error(e.message));
  };

  const selected = list.find((p) => p.id === selectedId) ?? null;

  const openKeyEdit = (entry: { keyType: string; key: string }) => {
    setEditKeyType(entry.keyType);
    setEditKeyValue(entry.key);
    setEditKeyOpen(true);
  };
  const saveKeyEdit = async (entry: { id: string }) => {
    if (editKeySaving) return;
    setEditKeySaving(true);
    try {
      await editKeyFn({
        data: {
          id: entry.id,
          keyType: editKeyType as (typeof withdrawalPixKeyTypes)[number],
          key: editKeyValue.trim(),
        },
      });
      toast.success("Chave Pix atualizada.");
      setEditKeyOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["pix-key-approvals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar. Tente de novo.");
    } finally {
      setEditKeySaving(false);
    }
  };
  const savePinEdit = async (businessId: string) => {
    if (!/^\d{4}$/.test(editPinValue)) {
      toast.error("A senha deve ter 4 dígitos numéricos.");
      return;
    }
    if (editPinSaving) return;
    setEditPinSaving(true);
    try {
      await editPinFn({ data: { businessId, pin: editPinValue } });
      toast.success("Senha de transferência atualizada.");
      setEditPinOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["pix-key-approvals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar. Tente de novo.");
    } finally {
      setEditPinSaving(false);
    }
  };

  if (selected) {
    const statusLabel =
      selected.status === "aprovado"
        ? "Aprovado"
        : selected.status === "recusado"
          ? "Recusado"
          : "Aguardando análise";
    const statusClass =
      selected.status === "aprovado"
        ? "border-emerald-400/35 bg-emerald-400/[0.10] text-emerald-300"
        : selected.status === "recusado"
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : "border-amber-400/35 bg-amber-400/[0.10] text-amber-300";
    return (
      <div className="mx-auto w-full p-4 sm:p-8">
        <section className="rounded-2xl border border-[var(--c-272a30)] bg-[var(--c-0b0b0e)] p-5">
          <div className="flex items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[#30333a] bg-[var(--c-15171b)] text-xl font-extrabold text-white">
              {(selected.businessName ?? "A").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-extrabold uppercase tracking-tight text-white">
                {selected.businessName}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8b8e96]">
                {selected.businessPhone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-3.5" aria-hidden="true" />
                    {formatPhoneBR(selected.businessPhone)}
                  </span>
                )}
                {selected.ownerName && <span>{selected.ownerName}</span>}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--c-202329)] pt-4">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${statusClass}`}
            >
              <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
              {statusLabel}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setEditKeyOpen(false);
                setEditPinOpen(false);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--c-9aa4b2)] transition-colors hover:text-white"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Voltar
            </button>
          </div>
        </section>

        <section className="mt-3 rounded-2xl border border-[var(--c-272a30)] bg-[var(--c-0b0b0e)] p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--c-2f83ff)]/30 bg-[var(--c-2f83ff)]/10 text-[var(--c-69a2ff)]">
              <KeyRound className="size-4" aria-hidden="true" />
            </span>
            {!editKeyOpen && (
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#686b74]">
                  Chave Pix · {keyTypeLabel[selected.keyType] ?? selected.keyType}
                </p>
                <p className="mt-1 break-all text-base font-bold text-white">
                  {maskPixKey(
                    selected.keyType as "cpf" | "cnpj" | "email" | "telefone" | "aleatoria",
                    selected.key,
                  )}
                </p>
              </div>
            )}
            {editKeyOpen ? (
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#686b74]">
                    Editar chave Pix
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditKeyOpen(false)}
                    aria-label="Cancelar edição"
                    className="rounded-md p-1 text-[#8b8e96] transition-colors hover:text-white"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <select
                  value={editKeyType}
                  onChange={(e) => {
                    setEditKeyType(e.target.value);
                    setEditKeyValue(maskPixKey(e.target.value as "cpf", editKeyValue));
                  }}
                  aria-label="Tipo de chave Pix"
                  className="w-full rounded-xl border border-[#30333a] bg-[var(--c-15171b)] px-3 py-2.5 text-sm text-white outline-none"
                >
                  {withdrawalPixKeyTypes.map((t) => (
                    <option key={t} value={t}>
                      {keyTypeLabel[t]}
                    </option>
                  ))}
                </select>
                <input
                  value={editKeyValue}
                  onChange={(e) =>
                    setEditKeyValue(maskPixKey(editKeyType as "cpf", e.target.value))
                  }
                  placeholder={keyTypeHint[editKeyType] ?? ""}
                  aria-label="Chave Pix"
                  className="w-full rounded-xl border border-[#30333a] bg-[var(--c-15171b)] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#5b5e66]"
                />
                <p className="text-[11px] text-[#686b74]">
                  {selected.status === "aprovado"
                    ? "Salva também na carteira do estabelecimento como chave fixa de saque."
                    : "A pontuação fica gravada e vai certinha para o gateway."}
                </p>
                <button
                  type="button"
                  onClick={() => void saveKeyEdit(selected)}
                  disabled={editKeySaving || !editKeyValue.trim()}
                  className="h-10 w-full rounded-xl bg-[linear-gradient(90deg,#9a7118,#f6d97a,#9a7118)] text-sm font-extrabold uppercase tracking-wide text-[#231a03] transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {editKeySaving ? "Salvando…" : "Salvar chave"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openKeyEdit(selected)}
                aria-label="Editar chave Pix"
                className="shrink-0 rounded-lg border border-[#30333a] bg-[var(--c-15171b)] p-2 text-[#8b8e96] transition-colors hover:border-[var(--c-2f83ff)]/50 hover:text-white"
              >
                <Pencil className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
          {!editKeyOpen && (
            <p className="mt-4 text-xs text-[#686b74]">
              Enviada em{" "}
              {new Date(selected.createdAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              . Confira se a chave está no nome do titular antes de aprovar.
            </p>
          )}
        </section>

        <section className="mt-3 rounded-2xl border border-[var(--c-272a30)] bg-[var(--c-0b0b0e)] p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#e8b93e]/30 bg-[#e8b93e]/10 text-[#f3d27a]">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            {editPinOpen ? (
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#686b74]">
                    Editar senha de transferência
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditPinOpen(false)}
                    aria-label="Cancelar edição da senha"
                    className="rounded-md p-1 text-[#8b8e96] transition-colors hover:text-white"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <input
                  value={editPinValue}
                  onChange={(e) => setEditPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="0000"
                  aria-label="Nova senha de transferência"
                  inputMode="numeric"
                  maxLength={4}
                  className="w-full rounded-xl border border-[#30333a] bg-[var(--c-15171b)] px-3 py-2.5 text-sm tracking-widest text-white outline-none placeholder:text-[#5b5e66]"
                />
                <button
                  type="button"
                  onClick={() => void savePinEdit(selected.businessId)}
                  disabled={editPinSaving || editPinValue.length !== 4}
                  className="h-10 w-full rounded-xl bg-[linear-gradient(90deg,#9a7118,#f6d97a,#9a7118)] text-sm font-extrabold uppercase tracking-wide text-[#231a03] transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {editPinSaving ? "Salvando…" : "Salvar senha"}
                </button>
              </div>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#686b74]">
                    Senha de transferência
                  </p>
                  <p className="mt-1 text-base font-bold tracking-[0.3em] text-white">
                    {selected.hasTransferPin ? "Configurado" : "Não configurado"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditPinValue("");
                    setEditPinOpen(true);
                  }}
                  aria-label="Editar senha de transferência"
                  className="shrink-0 rounded-lg border border-[#30333a] bg-[var(--c-15171b)] p-2 text-[#8b8e96] transition-colors hover:border-[var(--c-2f83ff)]/50 hover:text-white"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </section>

        {selected.status === "pendente" && (
          <div className="sticky bottom-3 mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => decide(selected.id, "recusado")}
              className="h-12 rounded-xl bg-[var(--c-4a90e2)] text-sm font-extrabold uppercase tracking-wide text-white transition-colors hover:brightness-110"
            >
              Rejeitar
            </button>
            <button
              type="button"
              onClick={() => decide(selected.id, "aprovado")}
              className="h-12 rounded-xl bg-[#22a06b] text-sm font-extrabold uppercase tracking-wide text-white transition-colors hover:brightness-110"
            >
              Aprovar
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!authorized) {
    return (
      <>
        <div className="mx-auto w-full p-4 sm:p-8">
          <p className="text-sm text-muted-foreground">Acesso protegido. Digite o PIN para continuar.</p>
        </div>
        <SecurityPinModal
          isOpen={true}
          onClose={() => void navigate({ to: "/painel/master" })}
          onSuccess={() => {
            setAuthorized(true);
            try {
              window.sessionStorage.setItem("agenda-agora:pix-auth", "1");
            } catch {
              // Ignora falhas de armazenamento.
            }
          }}
        />
      </>
    );
  }

  // Mostra apenas solicitações pendentes; aprovadas/recusadas somem do menu.
  // Deduplica por estabelecimento (mantém a mais recente) para não repetir.
  const seen = new Set<string>();
  const pending = list.filter((p) => {
    if (p.status !== "pendente") return false;
    if (seen.has(p.businessId)) return false;
    seen.add(p.businessId);
    return true;
  });
  const seenAprov = new Set<string>();
  const aprovadas = list.filter((p) => {
    if (p.status !== "aprovado") return false;
    if (seenAprov.has(p.businessId)) return false;
    seenAprov.add(p.businessId);
    return true;
  });

  return (
    <div className="master-skin mx-auto w-full p-4 sm:p-8">
      <div className="flex items-center gap-3">
        <span
          className="report-icon-box report-icon-box-lg relative z-10"
          style={
            {
              "--report-icon-color": TONE_VIOLET.color,
              "--report-icon-background": TONE_VIOLET.background,
              "--report-icon-border": TONE_VIOLET.border,
              "--report-icon-glow": TONE_VIOLET.glow,
            } as React.CSSProperties
          }
        >
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-white">
            Chaves Pix pendentes
          </h1>
          <p className="text-sm text-muted-foreground">
            Aprove ou rejeite chaves Pix — somente chaves no nome do titular da conta mãe podem ser
            vinculadas para saques via AgPay.
          </p>
        </div>
      </div>

      <section className="mt-6 overflow-x-auto report-x-scroll rounded-2xl border border-border bg-card report-luminous-card report-effect-strong">
        <table className="w-full min-w-[720px] text-sm md:table-fixed">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 w-20">ID</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Data envio</th>
              <th className="px-4 py-3 w-48">Ações</th>
            </tr>
          </thead>
          <tbody>
            {!pending.length && (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center">
                  <span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground">
                    <FileText className="size-5" />
                  </span>
                  <p className="mt-4 text-lg font-extrabold uppercase tracking-tight">
                    Nenhum Pix pendente
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Não há chaves Pix aguardando análise no momento.
                  </p>
                </td>
              </tr>
            )}
            {pending.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3 font-semibold">#{p.id.slice(-4)}</td>
                <td className="px-4 py-3">
                  <span className="block font-bold">{p.businessName}</span>
                  {p.ownerName && (
                    <span className="block text-xs text-muted-foreground">{p.ownerName}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.businessPhone ? formatPhoneBR(p.businessPhone) : "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(p.createdAt).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#30333a] bg-[var(--c-15171b)] px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:border-[var(--c-2f83ff)]/50"
                  >
                    <Eye className="size-4" aria-hidden="true" />
                    Ver chave Pix
                  </button>
                </td>
              </tr>
            ))}

          </tbody>
        </table>
      </section>

      <section className="mt-6 overflow-x-auto report-x-scroll rounded-2xl border border-border bg-card report-luminous-card report-effect-strong">
        <table className="w-full min-w-[860px] text-sm md:table-fixed">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Chave Pix</th>
              <th className="px-4 py-3">Senha</th>
              <th className="px-4 py-3 w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {!aprovadas.length && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhuma chave aprovada ainda.
                </td>
              </tr>
            )}
            {aprovadas.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <span className="block font-bold">{p.businessName}</span>
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                    Ag Pay liberado
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {p.businessPhone ? formatPhoneBR(p.businessPhone) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {keyTypeLabel[p.keyType] ?? p.keyType}
                  </span>
                  <span className="block break-all font-semibold text-white">
                    {maskPixKey(
                      p.keyType as "cpf" | "cnpj" | "email" | "telefone" | "aleatoria",
                      p.key,
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">{p.hasTransferPin ? "Configurado" : "Não configurado"}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    aria-label={`Editar chave de ${p.businessName}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#30333a] bg-[var(--c-15171b)] px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:border-[var(--c-2f83ff)]/50"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
