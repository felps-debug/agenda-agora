import { useState } from "react";
import { friendlyError } from "@/lib/error-page";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Search, MessagesSquare, UserRound, Cake, Percent, TrendingUp, TrendingDown, Minus, ArrowRight, Download, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { daysSince } from "@/lib/format";
import { mergeAppointmentCustomers } from "@/lib/customer-list";
import { formatPhoneBR, formatPhoneShort } from "@/lib/format-phone";
import { NoBusiness, EmptyList } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis } from "recharts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/painel/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Agenda Agora" },
      { name: "description", content: "Cadastro de clientes com contato e observações." },
      { property: "og:title", content: "Clientes — Agenda Agora" },
      { property: "og:description", content: "Cadastro de clientes com contato e observações." },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  const { businessId, canViewCustomerPhone } = useBusiness();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignView, setCampaignView] = useState<"menu" | "ausentes" | "aniversariantes" | "comparativo-individual">("menu");
  const [campaignMessage, setCampaignMessage] = useState(
    "Oi, {nome}! Sua presença faz falta!\nVenha passar um tempo conosco e conferir as novidades.\nEstamos te esperando!",
  );
  const [birthdayMessage, setBirthdayMessage] = useState(
    "Parabéns, {nome}! Que seu dia seja incrível!\nTemos uma surpresa esperando por você. Venha comemorar com a gente!",
  );
  const [birthdayTab, setBirthdayTab] = useState<"hoje" | "semana" | "mes">("hoje");
  const [selectedBirthdays, setSelectedBirthdays] = useState<string[]>([]);
  const monthNow = new Date();
  const monthCur = `${monthNow.getFullYear()}-${String(monthNow.getMonth() + 1).padStart(2, "0")}`;
  const monthPrevDate = new Date(monthNow.getFullYear(), monthNow.getMonth() - 1, 1);
  const monthPrev = `${monthPrevDate.getFullYear()}-${String(monthPrevDate.getMonth() + 1).padStart(2, "0")}`;
  const [monthA, setMonthA] = useState(monthPrev);
  const [monthB, setMonthB] = useState(monthCur);
  const [absenceRange, setAbsenceRange] = useState("30-39");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [term, setTerm] = useState("");
  const [customerToRemove, setCustomerToRemove] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    birthdate: "",
    cpf: "",
    notes: "",
  });

  const onlyDigits = (v: string) => v.replace(/\D/g, "");
  const maskCpf = (v: string) => {
    const d = onlyDigits(v).slice(0, 11);
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };
  const maskBirthdate = (v: string) => {
    const d = onlyDigits(v).slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  };
  const birthdateToIso = (v: string) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    if (!m) return null;
    const [, dd, mm, yyyy] = m;
    if (!dd || !mm || !yyyy) return null;
    if (Number(yyyy) < 1900 || Number(yyyy) > 2100) return null;
    const dt = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
    return Number.isNaN(dt.getTime()) ? null : `${yyyy}-${mm}-${dd}`;
  };
  const emptyForm = { name: "", phone: "", birthdate: "", cpf: "", notes: "" };
  const phoneDigits = onlyDigits(form.phone);
  const canSave = form.name.trim().length > 0 && phoneDigits.length >= 10;

  const customersQuery = useQuery({
    queryKey: ["customers", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("business_id", businessId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const visitsQuery = useQuery({
    queryKey: ["customer-visits", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("customer_id, customer_name, customer_phone, starts_at")
        .eq("business_id", businessId!)
        .neq("status", "bloqueado")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const customers = mergeAppointmentCustomers(customersQuery.data ?? [], visitsQuery.data ?? []);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["customers", businessId] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customers").insert({
        business_id: businessId!,
        name: form.name.trim(),
        phone: phoneDigits || null,
        birth_date: birthdateToIso(form.birthdate),
        cpf: onlyDigits(form.cpf) || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente cadastrado!");
      setOpen(false);
      setForm(emptyForm);
      void invalidate();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente removido.");
      void invalidate();
    },
  });

  if (!businessId) return <NoBusiness />;

  const filtered = customers.filter((c) =>
    `${c.name} ${c.phone ?? ""}`.toLowerCase().includes(term.toLowerCase()),
  );
  // Lista curta: 12 visíveis; o restante aparece pela busca.
  const visible = term.trim() ? filtered : filtered.slice(0, 12);

  const absentees = customers
    .map((c) => ({
      ...c,
      days: c.lastAppointmentAt === undefined ? null : daysSince(c.lastAppointmentAt),
    }))
    .filter((c) => {
      if (c.days === null) return false;
      if (absenceRange === "10-19") return c.days >= 10 && c.days <= 19;
      if (absenceRange === "20-29") return c.days >= 20 && c.days <= 29;
      if (absenceRange === "30-39") return c.days >= 30 && c.days <= 39;
      if (absenceRange === "40-49") return c.days >= 40 && c.days <= 49;
      if (absenceRange === "50-59") return c.days >= 50 && c.days <= 59;
      return c.days >= 60 && c.days <= 69;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const toggleClient = (id: string) =>
    setSelectedClients((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));

  const toggleAllAbsentees = () =>
    setSelectedClients((prev) =>
      prev.length === absentees.length ? [] : absentees.map((c) => c.id),
    );

  const sendCampaign = () => {
    if (!selectedClients.length) {
      toast.error("Selecione ao menos um cliente.");
      return;
    }
    toast.success(`Campanha preparada para ${selectedClients.length} cliente(s)!`);
  };

  type BirthdayCustomer = (typeof customers)[number] & {
    birth: { month: number; day: number; iso: string };
  };

  const getBirthInfo = (c: (typeof customers)[number]) => {
    const raw = (c as unknown as Record<string, unknown>)["birth_date"];
    if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const parts = raw.split("-").map(Number);
    const mm = parts[1];
    const dd = parts[2];
    if (!mm || !dd) return null;
    return { month: mm, day: dd, iso: raw };
  };

  const now = new Date();
  const todayMonth = now.getMonth() + 1;
  const birthdays: BirthdayCustomer[] = [];
  for (const c of customers) {
    const birth = getBirthInfo(c);
    if (!birth) continue;
    if (birthdayTab === "mes") {
      if (birth.month !== todayMonth) continue;
    } else {
      const thisYear = now.getFullYear();
      const next = new Date(thisYear, birth.month - 1, birth.day);
      const startOfToday = new Date(thisYear, now.getMonth(), now.getDate());
      let diff = Math.round((next.getTime() - startOfToday.getTime()) / 86400000);
      if (diff < 0) diff += 365;
      if (birthdayTab === "hoje") {
        if (diff !== 0) continue;
      } else if (diff < 0 || diff > 7) continue;
    }
    birthdays.push({ ...c, birth });
  }
  birthdays.sort((a, b) => {
    if (a.birth.month !== b.birth.month) return a.birth.month - b.birth.month;
    if (a.birth.day !== b.birth.day) return a.birth.day - b.birth.day;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  const toggleBirthday = (id: string) =>
    setSelectedBirthdays((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));

  const toggleAllBirthdays = () =>
    setSelectedBirthdays((prev) =>
      prev.length === birthdays.length ? [] : birthdays.map((c) => c.id),
    );

  const sendBirthdayCampaign = () => {
    if (!selectedBirthdays.length) {
      toast.error("Selecione ao menos um aniversariante.");
      return;
    }
    toast.success(`Campanha de aniversário preparada para ${selectedBirthdays.length} cliente(s)!`);
  };

  const countInMonth = (ym: string) =>
    (visitsQuery.data ?? []).filter(
      (a) => typeof a.starts_at === "string" && a.starts_at.slice(0, 7) === ym,
    ).length;
  const countA = countInMonth(monthA);
  const countB = countInMonth(monthB);
  const pctChange = countA === 0 ? (countB === 0 ? 0 : 100) : Math.round(((countB - countA) / countA) * 100);
  const shortMonth = (ym: string) => {
    const parts = ym.split("-").map(Number);
    const y = parts[0];
    const m = parts[1];
    if (!y || !m) return ym;
    const name = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
    return `${name.charAt(0).toUpperCase()}${name.slice(1)}/${y}`;
  };
  const comparativeMessage = `${countB} atendimentos em ${shortMonth(monthB)}, contra ${countA} em ${shortMonth(monthA)}.`;

  const daysInMonth = (ym: string) => {
    const parts = ym.split("-").map(Number);
    const y = parts[0];
    const m = parts[1];
    if (!y || !m) return 30;
    return new Date(y, m, 0).getDate();
  };
  const dailyInMonth = (ym: string) => {
    const arr: number[] = new Array(daysInMonth(ym)).fill(0);
    for (const a of visitsQuery.data ?? []) {
      if (typeof a.starts_at === "string" && a.starts_at.slice(0, 7) === ym) {
        const d = Number(a.starts_at.slice(8, 10));
        if (d >= 1 && d <= arr.length) arr[d - 1] = (arr[d - 1] ?? 0) + 1;
      }
    }
    return arr;
  };
  const dailyA = dailyInMonth(monthA);
  const dailyB = dailyInMonth(monthB);
  const daysMax = Math.max(dailyA.length, dailyB.length, 1);
  const avgB = (countB / (dailyB.length || 1)).toFixed(1).replace(".", ",");
  let bestIdx = -1;
  let bestVal = 0;
  dailyB.forEach((v, i) => {
    if (v > bestVal) {
      bestVal = v;
      bestIdx = i;
    }
  });
  const bestWeekday = (() => {
    if (bestIdx < 0) return "—";
    const parts = monthB.split("-").map(Number);
    const wd = new Date(parts[0] ?? 2026, (parts[1] ?? 1) - 1, bestIdx + 1)
      .toLocaleDateString("pt-BR", { weekday: "short" })
      .replace(".", "");
    return wd.charAt(0).toUpperCase() + wd.slice(1);
  })();
  const chartTicks = [1, 8, 15, 22, 29].filter((d) => d <= daysMax);
  const chartData = Array.from({ length: daysMax }, (_, i) => ({
    day: i + 1,
    anterior: dailyA[i] ?? 0,
    atual: dailyB[i] ?? 0,
  }));

  const exportCsv = () => {
    const rows = filtered.map((c) => [
      c.name,
      canViewCustomerPhone ? formatPhoneBR(c.phone ?? "") : "",
      c.email ?? "",
      c.lastAppointmentAt ? new Date(c.lastAppointmentAt).toLocaleDateString("pt-BR") : "",
      (c.notes ?? "").replace(/\s+/g, " "),
    ]);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [["Nome", "Telefone", "E-mail", "Último atendimento", "Observações"], ...rows]
      .map((r) => r.map((cell) => escape(String(cell))).join(";"))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Lista de clientes exportada");
  };

  return (
    <div>
      <section className="report-luminous-card report-effect-strong p-4 sm:p-6">
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--c-1677ff)]/35 bg-[var(--c-1677ff)]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--c-6db3ff)]">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-[var(--c-4d9bff)] shadow-[0_0_8px_var(--c-rgba-77-155-255-a0d9)]"
            />
            Clientes
          </span>
          <h1 className="mt-2 max-w-2xl font-['Manrope'] text-xl font-black tracking-tight text-white md:text-2xl">
            Clientes
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--c-9aa4b2)]">
            Histórico e contato de quem atende com você.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="relative inline-flex w-auto -translate-y-[6%]">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-6 top-0 z-10 h-[2.7px] w-16 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,#ffffff,#ffffff)] shadow-[0_0_12px_rgba(255,255,255,0.95),0_0_30px_rgba(255,255,255,0.6)]"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-6 top-0 z-0 h-8 w-16 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.35),transparent_75%)] blur-[6px]"
              />
              <Button
                onClick={() => {
                  setCampaignView("menu");
                  setSelectedClients([]);
                  setSelectedBirthdays([]);
                  setCampaignOpen(true);
                }}
                disabled={!filtered.length}
                className="w-auto rounded-xl border border-[rgba(255,255,255,0.4)] bg-[rgba(255,255,255,0.08)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_0_18px_rgba(255,255,255,0.25),0_0_32px_rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.14)] hover:text-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_24px_rgba(255,255,255,0.4),0_0_40px_rgba(255,255,255,0.2)]"
              >
                <MessagesSquare className="size-4" strokeWidth={2.2} /> Campanhas
              </Button>
            </span>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <span className="relative inline-flex w-full sm:w-auto">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-6 top-0 z-10 h-[2.7px] w-16 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,var(--c-0187fc),var(--c-01fbfd))] shadow-[0_0_12px_var(--c-rgba-1-251-253-a0d9),0_0_30px_var(--c-rgba-0-30-252-a0d7)]"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-6 top-0 z-0 h-8 w-16 bg-[radial-gradient(ellipse_at_50%_0%,var(--c-rgba-109-179-255-a0d28),transparent_75%)] blur-[6px]"
                  />
                  <Button className="w-full rounded-xl border border-[var(--c-rgba-51-125-255-a0d29)] bg-[var(--c-rgba-22-119-255-a0d09)] text-[var(--c-69a2ff)] shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_0_18px_var(--c-rgba-22-119-255-a0d08)] hover:border-[var(--c-rgba-51-125-255-a0d5)] hover:bg-[var(--c-rgba-22-119-255-a0d14)] hover:text-[var(--c-8fb5ff)] sm:w-auto">
                    <Plus className="size-4" strokeWidth={2.2} /> Novo cliente
                  </Button>
                </span>
              </DialogTrigger>

              <DialogContent className="professional-dialog max-h-[92vh] max-w-lg overflow-y-auto p-0">
                <DialogHeader className="professional-dialog-header">
                  <div className="flex items-start gap-3 text-left">
                    <div className="professional-dialog-icon">
                      <UserRound className="size-[1.05rem]" strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0">
                      <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[var(--c-f1f2f4)]">
                        Cadastrar Cliente
                      </DialogTitle>
                      <p className="mt-1 text-xs leading-relaxed text-[#686b74]">
                        Dados de contato e observações do cliente.
                      </p>
                    </div>
                  </div>
                </DialogHeader>
                <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                  <div className="professional-form-section space-y-4">
                    <div className="space-y-2">
                      <Label className="professional-section-label" htmlFor="cname">
                        Nome*
                      </Label>
                      <Input
                        id="cname"
                        placeholder="Nome"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="professional-section-label" htmlFor="cphone">
                          Telefone*
                        </Label>
                        <Input
                          id="cphone"
                          inputMode="numeric"
                          placeholder="(00)00000-0000"
                          value={formatPhoneBR(form.phone)}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              phone: e.target.value.replace(/\D/g, "").slice(0, 11),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="professional-section-label" htmlFor="cbirthdate">
                          Data Nascimento
                        </Label>
                        <Input
                          id="cbirthdate"
                          inputMode="numeric"
                          placeholder="DD/MM/AAAA"
                          value={form.birthdate}
                          onChange={(e) => setForm({ ...form, birthdate: maskBirthdate(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="professional-section-label" htmlFor="ccpf">
                        CPF
                      </Label>
                      <Input
                        id="ccpf"
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        value={form.cpf}
                        onChange={(e) => setForm({ ...form, cpf: maskCpf(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="professional-section-label" htmlFor="cnotes">
                        Observações
                      </Label>
                      <Textarea
                        id="cnotes"
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="Observações.."
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="professional-dialog-footer gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setForm(emptyForm);
                    }}
                    className="bg-[#e5484d] text-white hover:bg-[#d13b40]"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => create.mutate()}
                    disabled={!canSave || create.isPending}
                    className="bg-[#22a06b] text-white hover:bg-[#1d8f5f]"
                  >
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </section>

      <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}>
        <DialogContent
          className={`professional-dialog max-h-[92vh] max-w-lg overflow-y-auto p-0 ${campaignView !== "menu" ? "[&_[data-slot=dialog-close]]:hidden" : ""}`}
        >
          {campaignView !== "menu" && (
            <button
              type="button"
              onClick={() => setCampaignView("menu")}
              aria-label="Voltar ao menu"
              className="absolute right-2 top-2 z-50 grid size-11 cursor-pointer place-items-center rounded-lg bg-[var(--c-202630)] text-white shadow-sm transition-colors hover:bg-[var(--c-343b48)]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          {campaignView === "menu" ? (
            <>
              <DialogHeader className="professional-dialog-header">
                <div className="flex items-start gap-3 text-left">
                  <div className="professional-dialog-icon">
                    <MessagesSquare className="size-[1.05rem]" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[var(--c-f1f2f4)]">
                      Selecione o relatório abaixo
                    </DialogTitle>
                    <p className="mt-1 text-xs leading-relaxed text-[#686b74]">
                      Campanhas e relatórios de clientes.
                    </p>
                  </div>
                </div>
              </DialogHeader>
              <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                <div className="professional-form-section">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: "aniversariantes", label: "Aniversariantes", Icon: Cake, color: "text-[var(--c-a855f7)]" },
                      { id: "comparativo-individual", label: "Comparativo Individual", Icon: Percent, color: "text-[#facc15]" },
                      { id: "campanha", label: "Campanha", Icon: MessagesSquare, color: "text-white" },
                      { id: "comparativo-evolutivo", label: "Comparativo Evolutivo", Icon: TrendingUp, color: "text-[#22c55e]" },
                    ].map(({ id, label, Icon, color }) => (
                      <div key={id} className="flex flex-col items-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (id === "campanha") {
                              setCampaignView("ausentes");
                            } else if (id === "aniversariantes") {
                              setBirthdayTab("hoje");
                              setSelectedBirthdays([]);
                              setCampaignView("aniversariantes");
                            } else if (id === "comparativo-individual") {
                              setCampaignView("comparativo-individual");
                            } else {
                              toast.success(`${label}: relatório em breve`);
                            }
                          }}
                          className="flex h-32 w-full items-center justify-center rounded-xl border border-[var(--c-rgba-51-125-255-a0d29)] bg-[var(--c-rgba-22-119-255-a0d09)] shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_0_18px_var(--c-rgba-22-119-255-a0d08)] transition-colors hover:border-[var(--c-rgba-51-125-255-a0d5)] hover:bg-[var(--c-rgba-22-119-255-a0d14)]"
                          aria-label={label}
                        >
                          <Icon className={`size-12 ${color}`} strokeWidth={1.8} />
                        </button>
                        <span className="mt-2 text-center text-[13px] font-medium leading-tight text-[var(--c-e5e7eb)]">
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter className="professional-dialog-footer gap-2">
                <span className="mr-auto self-center text-[13px] text-[#686b74]">
                  Total de clientes: <span className="font-semibold text-[var(--c-69a2ff)]">{filtered.length}</span>
                </span>
                <Button
                  type="button"
                  onClick={exportCsv}
                  className="bg-[var(--c-2a2e36)] text-white hover:bg-[var(--c-343945)]"
                  aria-label="Exportar lista de clientes"
                >
                  <Download className="size-4" /> Exportar
                </Button>
                <Button
                  type="button"
                  onClick={() => setCampaignOpen(false)}
                  className="bg-[#e5484d] text-white hover:bg-[#d13b40]"
                >
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : campaignView === "ausentes" ? (
            <>
              <DialogHeader className="professional-dialog-header">
                <div className="flex items-start gap-3 text-left">
                  <div className="professional-dialog-icon">
                    <MessagesSquare className="size-[1.05rem]" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[var(--c-f1f2f4)]">
                      Campanha de Ausentes
                    </DialogTitle>
                    <p className="mt-1 text-xs leading-relaxed text-[#686b74]">
                      Mensagem e clientes por período de ausência.
                    </p>
                  </div>
                </div>
              </DialogHeader>
              <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                <div className="professional-form-section space-y-4">
                  <div className="space-y-2">
                    <Label className="professional-section-label" htmlFor="campaign-message">
                      Mensagem:
                    </Label>
                    <Textarea
                      id="campaign-message"
                      value={campaignMessage}
                      onChange={(e) => setCampaignMessage(e.target.value)}
                      rows={4}
                      placeholder="Oi, {nome}! Sua presença faz falta!"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="professional-section-label" htmlFor="absence-range">
                      Período da Ausência:
                    </Label>
                    <div className="flex gap-2">
                      <select
                        id="absence-range"
                        value={absenceRange}
                        onChange={(e) => setAbsenceRange(e.target.value)}
                        className="h-10 min-w-0 flex-1 rounded-[0.7rem] border border-[#30333a] bg-[var(--c-0d0e11)] px-3 text-sm text-[var(--c-e7e9ed)] outline-none focus-visible:border-[var(--c-2f83ff)]"
                      >
                        <option value="10-19">10 a 19 Dias</option>
                        <option value="20-29">20 a 29 Dias</option>
                        <option value="30-39">30 a 39 Dias</option>
                        <option value="40-49">40 a 49 Dias</option>
                        <option value="50-59">50 a 59 Dias</option>
                        <option value="60-69">60 a 69 Dias</option>
                      </select>
                      <Button
                        type="button"
                        onClick={sendCampaign}
                        className="h-10 rounded-md border border-[rgba(34,197,94,0.4)] bg-[rgba(34,197,94,0.09)] text-[#4ade80] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_18px_rgba(34,197,94,0.283),0_0_32px_rgba(34,197,94,0.121)] hover:border-[rgba(34,197,94,0.65)] hover:bg-[rgba(34,197,94,0.16)] hover:text-[#86efac] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_24px_rgba(34,197,94,0.364),0_0_40px_rgba(34,197,94,0.162)]"
                      >
                        Enviar
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="professional-section-label">
                      Clientes ({absentees.length})
                    </Label>
                    <div className="overflow-hidden rounded-[0.7rem] border border-[#30333a] bg-[var(--c-0d0e11)]">
                      <div className="grid grid-cols-[28px_1fr_auto] items-center gap-2 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#8b8e96]">
                        <input
                          type="checkbox"
                          checked={absentees.length > 0 && selectedClients.length === absentees.length}
                          onChange={toggleAllAbsentees}
                          className="size-4 accent-[var(--c-2f83ff)]"
                          aria-label="Selecionar todos"
                        />
                        <span>Nome</span>
                        <span>Telefone</span>
                      </div>
                      <div className="max-h-[320px] overflow-y-auto">
                        {absentees.length === 0 ? (
                          <p className="px-3 py-6 text-center text-sm text-[#656871]">
                            Nenhum cliente neste período.
                          </p>
                        ) : (
                          absentees.map((c) => (
                            <label
                              key={c.id}
                              className="grid cursor-pointer grid-cols-[28px_1fr_auto] items-center gap-2 border-t border-[var(--c-24272e)] px-3 py-2.5 text-sm text-[var(--c-e7e9ed)] hover:bg-[var(--c-rgba-22-119-255-a0d06)]"
                            >
                              <input
                                type="checkbox"
                                checked={selectedClients.includes(c.id)}
                                onChange={() => toggleClient(c.id)}
                                className="size-4 accent-[var(--c-2f83ff)]"
                              />
                              <span className="truncate font-medium">{c.name}</span>
                              <span className="whitespace-nowrap">
                                {canViewCustomerPhone ? formatPhoneShort(c.phone) || "—" : "•••••••••"}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : campaignView === "comparativo-individual" ? (
            <>
              <DialogHeader className="professional-dialog-header">
                <div className="flex items-start gap-3 text-left">
                  <div className="professional-dialog-icon">
                    <Percent className="size-[1.05rem]" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1 pr-12">
                    <DialogTitle className="text-base font-semibold tracking-[-0.025em] text-[var(--c-f1f2f4)] sm:text-lg">
                      Comparativo Individual
                    </DialogTitle>
                    <p className="mt-1 text-xs leading-relaxed text-[#686b74]">
                      Compare os atendimentos entre dois meses.
                    </p>
                  </div>
                </div>
              </DialogHeader>
              <div className="px-3 pb-3 sm:px-5 sm:pb-5">
                <div className="professional-form-section space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b6f78]">
                      Comparar atendimentos
                    </p>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        pctChange > 0
                          ? "border-[#4ade80]/25 bg-[#4ade80]/10 text-[#4ade80]"
                          : pctChange < 0
                            ? "border-[#f87171]/25 bg-[#f87171]/10 text-[#f87171]"
                            : "border-white/[0.08] bg-white/[0.03] text-[#8b8e96]"
                      }`}
                    >
                      {pctChange > 0 ? (
                        <TrendingUp className="size-3.5" strokeWidth={2.4} />
                      ) : pctChange < 0 ? (
                        <TrendingDown className="size-3.5" strokeWidth={2.4} />
                      ) : (
                        <Minus className="size-3.5" strokeWidth={2.4} />
                      )}
                      {pctChange > 0 ? `+${pctChange}` : pctChange}%
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                    <label className="rounded-[0.85rem] border border-white/[0.06] bg-white/[0.015] p-3 transition-colors focus-within:border-white/[0.16]">
                      <span className="block text-[9px] font-semibold uppercase tracking-widest text-[#6b6f78]">
                        Período base
                      </span>
                      <span className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-2xl font-light leading-none tracking-tighter text-white">
                          {countA}
                        </span>
                        <span className="text-[10px] font-medium uppercase tracking-wider text-[#62666f]">
                          atend.
                        </span>
                      </span>
                      <input
                        type="month"
                        value={monthA}
                        onChange={(e) => e.target.value && setMonthA(e.target.value)}
                        className="mt-2.5 w-full cursor-pointer bg-transparent text-xs font-medium text-[#9aa4b2] outline-none [color-scheme:dark]"
                        aria-label="Primeiro mês"
                      />
                    </label>

                    <div className="hidden justify-center sm:flex">
                      <ArrowRight className="size-4 text-[#4a4e57]" strokeWidth={2} aria-hidden="true" />
                    </div>

                    <label className="rounded-[0.85rem] border border-[#d9a83f]/25 bg-[#d9a83f]/[0.07] p-3 transition-colors focus-within:border-[#d9a83f]/50">
                      <span className="block text-[9px] font-semibold uppercase tracking-widest text-[#a8894a]">
                        Período comparado
                      </span>
                      <span className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-2xl font-light leading-none tracking-tighter text-[#f0c674]">
                          {countB}
                        </span>
                        <span className="text-[10px] font-medium uppercase tracking-wider text-[#a8894a]">
                          atend.
                        </span>
                      </span>
                      <input
                        type="month"
                        value={monthB}
                        onChange={(e) => e.target.value && setMonthB(e.target.value)}
                        className="mt-2.5 w-full cursor-pointer bg-transparent text-xs font-medium text-[#e0c48b] outline-none [color-scheme:dark]"
                        aria-label="Segundo mês"
                      />
                    </label>
                  </div>

                  <p className="rounded-[0.7rem] border border-white/[0.04] bg-white/[0.015] px-3 py-2 text-xs leading-relaxed text-[#8b8e96]">
                    {comparativeMessage}
                  </p>
                                    <div className="overflow-hidden rounded-[0.9rem] border border-white/[0.05] bg-white/[0.02] p-4">
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h4 className="font-[Chakra_Petch] text-[12px] font-bold tracking-tight text-white">
                          Atendimentos
                        </h4>
                        <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-neutral-600">
                          Por dia · {shortMonth(monthB)}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[9px] font-semibold uppercase tracking-widest">
                          <span className="inline-flex items-center gap-1.5 text-neutral-500">
                            <span aria-hidden="true" className="size-1.5 rounded-full bg-neutral-500" />
                            {shortMonth(monthA)}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-[#d9a83f]">
                            <span aria-hidden="true" className="size-1.5 rounded-full bg-[#d9a83f]" />
                            {shortMonth(monthB)}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                        <div className="text-right">
                          <p className="text-[9px] font-semibold uppercase tracking-widest text-neutral-600">
                            Total
                          </p>
                          <p className="text-sm font-light tracking-tighter text-white">{countB}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-semibold uppercase tracking-widest text-neutral-600">
                            Média/dia
                          </p>
                          <p className="text-sm font-light tracking-tighter text-neutral-400">{avgB}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-semibold uppercase tracking-widest text-neutral-600">
                            Melhor dia
                          </p>
                          <p className="text-sm font-light tracking-tighter text-[#d9a83f]">{bestWeekday}</p>
                        </div>
                      </div>
                    </div>
                    <div
                      className="h-[190px] w-full"
                      role="img"
                      aria-label={`Atendimentos por dia em ${shortMonth(monthB)}`}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="clientesPerf" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#d9a83f" stopOpacity={0.22} />
                              <stop offset="100%" stopColor="#d9a83f" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" vertical={false} />
                          <XAxis
                            dataKey="day"
                            ticks={chartTicks}
                            padding={{ left: 10, right: 10 }}
                            tickFormatter={(v) => String(v)}
                            tick={{ fill: "rgba(163,163,163,0.45)", fontSize: 10, fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Area
                            type="monotone"
                            dataKey="anterior"
                            stroke="rgba(163,163,163,0.35)"
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                            fill="transparent"
                            dot={false}
                            activeDot={false}
                          />
                          <Area
                            type="monotone"
                            dataKey="atual"
                            stroke="#d9a83f"
                            strokeWidth={2}
                            fill="url(#clientesPerf)"
                            dot={{ r: 2.5, stroke: "#d9a83f", strokeWidth: 1.5, fill: "var(--c-09090b)" }}
                            activeDot={{ r: 4, stroke: "#d9a83f", strokeWidth: 1.5, fill: "var(--c-09090b)" }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader className="professional-dialog-header">
                <div className="flex items-start gap-3 text-left">
                  <div className="professional-dialog-icon">
                    <Cake className="size-[1.05rem]" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[var(--c-f1f2f4)]">
                      Campanha de Aniversariantes
                    </DialogTitle>
                    <p className="mt-1 text-xs leading-relaxed text-[#686b74]">
                      Campanha de aniversário por período.
                    </p>
                  </div>
                </div>
              </DialogHeader>
              <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                <div className="professional-form-section space-y-4">
                  <div className="space-y-2">
                    <Label className="professional-section-label" htmlFor="birthday-message">
                      Mensagem:
                    </Label>
                    <Textarea
                      id="birthday-message"
                      value={birthdayMessage}
                      onChange={(e) => setBirthdayMessage(e.target.value)}
                      rows={3}
                      placeholder="Parabéns, {nome}!"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="grid min-w-0 flex-1 grid-cols-3 gap-1 rounded-[0.7rem] border border-[#30333a] bg-[var(--c-0d0e11)] p-1">
                      {(
                        [
                          { id: "hoje", label: "Hoje" },
                          { id: "semana", label: "Semana" },
                          { id: "mes", label: "Mês" },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setBirthdayTab(t.id)}
                          className={`h-9 rounded-md text-sm font-semibold transition-colors ${birthdayTab === t.id ? "bg-white text-black" : "text-[var(--c-9aa4b2)] hover:text-white"}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <Button
                      type="button"
                      onClick={sendBirthdayCampaign}
                      className="h-10 rounded-md border border-[rgba(34,197,94,0.4)] bg-[rgba(34,197,94,0.09)] text-[#4ade80] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_18px_rgba(34,197,94,0.283),0_0_32px_rgba(34,197,94,0.121)] hover:border-[rgba(34,197,94,0.65)] hover:bg-[rgba(34,197,94,0.16)] hover:text-[#86efac] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_24px_rgba(34,197,94,0.364),0_0_40px_rgba(34,197,94,0.162)]"
                    >
                      Enviar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="overflow-hidden rounded-[0.7rem] border border-[#30333a] bg-[var(--c-0d0e11)]">
                      <div className="grid grid-cols-[28px_1fr_auto] items-center gap-2 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#8b8e96]">
                        <input
                          type="checkbox"
                          checked={birthdays.length > 0 && selectedBirthdays.length === birthdays.length}
                          onChange={toggleAllBirthdays}
                          className="size-4 accent-[var(--c-2f83ff)]"
                          aria-label="Selecionar todos"
                        />
                        <span>Nome</span>
                        <span>Aniversário</span>
                      </div>
                      <div className="max-h-[320px] overflow-y-auto">
                        {birthdays.length === 0 ? (
                          <p className="px-3 py-6 text-center text-sm text-[#656871]">
                            Nenhum aniversariante encontrado.
                          </p>
                        ) : (
                          birthdays.map((c) => (
                            <label
                              key={c.id}
                              className="grid cursor-pointer grid-cols-[28px_1fr_auto] items-center gap-2 border-t border-[var(--c-24272e)] px-3 py-2.5 text-sm text-[var(--c-e7e9ed)] hover:bg-[var(--c-rgba-22-119-255-a0d06)]"
                            >
                              <input
                                type="checkbox"
                                checked={selectedBirthdays.includes(c.id)}
                                onChange={() => toggleBirthday(c.id)}
                                className="size-4 accent-[var(--c-2f83ff)]"
                              />
                              <span className="truncate font-medium">{c.name}</span>
                              <span className="whitespace-nowrap">
                                {String(c.birth.day).padStart(2, "0")}/{String(c.birth.month).padStart(2, "0")}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div className="relative mb-4 mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar cliente pelo nome"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      {visitsQuery.isError && (
        <p role="alert" className="mb-4 rounded-xl border border-destructive/40 p-4 text-sm">
          Não foi possível carregar o histórico de visitas; os dias ausente podem estar incompletos.
        </p>
      )}

      {customersQuery.isError || visitsQuery.isError ? (
        <p role="alert" className="rounded-xl border border-destructive/40 p-6 text-center text-sm">
          Não foi possível carregar os clientes. Atualize a página e tente novamente.
        </p>
      ) : !filtered.length ? (
        <EmptyList text="Nenhum cliente encontrado." />
      ) : (
        <div className="report-luminous-card report-effect-strong mt-[4.5%] overflow-x-auto">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 z-10 h-[2px] w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-[var(--c-4d9cff)] to-transparent shadow-[0_0_14px_var(--c-rgba-77-155-255-a0d9)]"
          />
          <table className="relative z-10 w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Telefone</th>
                <th className="py-3 pl-12 pr-4 text-left">Dias ausente</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const last = c.lastAppointmentAt;
                const days = last === undefined ? null : daysSince(last);
                return (
                  <tr key={c.id} className="border-t border-border/60">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[15.4px] text-white">
                      {canViewCustomerPhone ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className="size-3.5 shrink-0 bg-[#25d366]"
                            style={{
                              WebkitMaskImage: "url('/sidebar-whatsapp-mask.png')",
                              maskImage: "url('/sidebar-whatsapp-mask.png')",
                              WebkitMaskSize: "contain",
                              maskSize: "contain",
                              WebkitMaskRepeat: "no-repeat",
                              maskRepeat: "no-repeat",
                              WebkitMaskPosition: "center",
                              maskPosition: "center",
                            }}
                          />
                          {formatPhoneShort(c.phone) || "—"}
                        </span>
                      ) : (
                        "•••••••••"
                      )}
                    </td>
                    <td className="whitespace-nowrap py-3 pl-[56px] pr-4 text-[15.4px]">{days === null ? "-" : `${days} dias`}</td>
                    <td className="px-4 py-3 text-right">
                      {c.manual && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCustomerToRemove(c.id)}
                          aria-label={`Remover ${c.name}`}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="border-t border-border/60 px-4 py-3 text-center text-[15.4px] text-muted-foreground">
            Total De Clientes: <span className="text-primary">{filtered.length}</span>
          </p>
        </div>
      )}
      <AlertDialog
        open={customerToRemove !== null}
        onOpenChange={(open) => !open && setCustomerToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              O cadastro manual será excluído. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (customerToRemove)
                  remove.mutate(customerToRemove, { onSettled: () => setCustomerToRemove(null) });
              }}
              disabled={remove.isPending}
            >
              Remover cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

