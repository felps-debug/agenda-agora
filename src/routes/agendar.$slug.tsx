import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  Clock,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  User,
  X,
  History,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/format";
import { getLogoUrl } from "@/lib/logo";
import {
  getAvailability,
  getOpenDays,
  reserveBooking,
  generateDepositPix,
  cancelDepositBooking,
  getDepositStatus,
  getMyBookings,
} from "@/lib/booking.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export const Route = createFileRoute("/agendar/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Agendar horário — ${params.slug}` },
      {
        name: "description",
        content: "Escolha o serviço, pague o sinal por Pix e confirme seu horário na hora.",
      },
      { property: "og:title", content: "Agende seu horário" },
      {
        property: "og:description",
        content: "Escolha o serviço, pague o sinal por Pix e confirme seu horário na hora.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicBooking,
});

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  deposit_cents: number;
  description: string | null;
  image_path: string | null;
  show_price: boolean;
  show_duration: boolean;
};

type Professional = { id: string; name: string; role: string | null };

const DAY_LABEL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function ddmm(date: string) {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

function fullDate(date: string) {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function storageKey(slug: string) {
  return `agenda-servico:${slug}:charges`;
}

function readCharges(slug: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function PublicBooking() {
  const { slug } = Route.useParams();
  const [tab, setTab] = useState<"agendar" | "historico">("agendar");
  const [service, setService] = useState<Service | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pageStart, setPageStart] = useState(0);
  const [charges, setCharges] = useState<string[]>([]);
  const [activeCharge, setActiveCharge] = useState<string | null>(null);

  const availabilityFn = useServerFn(getAvailability);
  const openDaysFn = useServerFn(getOpenDays);
  const reserveFn = useServerFn(reserveBooking);
  const bookingsFn = useServerFn(getMyBookings);

  useEffect(() => {
    setCharges(readCharges(slug));
  }, [slug]);

  const saveCharge = useCallback(
    (id: string) => {
      const next = [id, ...readCharges(slug)].slice(0, 30);
      window.localStorage.setItem(storageKey(slug), JSON.stringify(next));
      setCharges(next);
    },
    [slug],
  );

  const { data: business, isLoading } = useQuery({
    queryKey: ["public-business", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, category, phone, address, status, brand_primary, brand_background")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Consulta separada: logo_url é uma coluna nova e opcional. Isolada da query
  // principal pra uma eventual falha nela (ex.: coluna ainda não propagada em
  // algum ambiente) não derrubar a página de agendamento inteira.
  const { data: logoPath } = useQuery({
    queryKey: ["public-business-logo-path", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("logo_url")
        .eq("id", business!.id)
        .maybeSingle();
      if (error) return null;
      return data?.logo_url ?? null;
    },
  });

  const { data: logoUrl } = useQuery({
    queryKey: ["public-business-logo", logoPath],
    enabled: !!logoPath,
    queryFn: () => getLogoUrl(logoPath!),
  });

  const { data: services } = useQuery({
    queryKey: ["public-services", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, duration_minutes, price_cents, deposit_cents, description, image_path, show_price, show_duration")
        .eq("business_id", business!.id)
        .eq("active", true)
        .eq("show_service", true)
        .order("name");
      if (error) throw error;
      return data as Service[];
    },
  });

  const { data: professionals } = useQuery({
    queryKey: ["public-professionals", service?.id], enabled: !!service,
    queryFn: async () => {
      const { data: linked, error } = await supabase.from("service_professionals").select("professional_id").eq("service_id", service!.id);
      if (error) throw error;
      if (!linked.length) return [] as Professional[];
      const { data, error: peopleError } = await supabase.from("professionals").select("id,name,role").in("id", linked.map((item) => item.professional_id)).eq("active", true).order("name");
      if (peopleError) throw peopleError; return data as Professional[];
    },
  });

  const { data: serviceImage } = useQuery({
    queryKey: ["public-service-image", service?.image_path], enabled: !!service?.image_path,
    queryFn: () => getLogoUrl(service?.image_path),
  });

  const { data: openDays } = useQuery({
    queryKey: ["public-days", slug],
    queryFn: () => openDaysFn({ data: { slug } }),
  });

  const { data: availability, isFetching: loadingSlots } = useQuery({
    queryKey: ["public-slots", slug, service?.id, professional?.id, date],
    enabled: !!service && !!date && ((professionals?.length ?? 0) === 0 || !!professional),
    queryFn: () => availabilityFn({ data: { slug, serviceId: service!.id, date: date!, professionalId: professional?.id ?? null } }),
  });

  const bookings = useQuery({
    queryKey: ["public-bookings", slug, charges.join(",")],
    enabled: charges.length > 0,
    refetchInterval: 8000,
    queryFn: () => bookingsFn({ data: { chargeIds: charges } }),
  });

  const days = openDays?.days ?? [];
  const visibleDays = useMemo(() => days.slice(pageStart, pageStart + 7), [days, pageStart]);

  const reserve = useMutation({
    mutationFn: () =>
      reserveFn({
        data: {
          slug,
          serviceId: service!.id,
          date: date!,
          time: time!,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerCpfCnpj: cpfCnpj.trim(),
          professionalId: professional?.id ?? null,
        },
      }),
    onSuccess: (r) => {
      saveCharge(r.chargeId);
      setActiveCharge(r.chargeId);
      setService(null);
      setProfessional(null);
      setDate(null);
      setTime(null);
      setTab("historico");
      void bookings.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (name.trim().length < 2) return setFormError("Informe o seu nome e sobrenome");
    if (phone.trim().length < 8) return setFormError("Informe o seu telefone");
    const cpfCnpjDigits = cpfCnpj.replace(/\D/g, "");
    if (cpfCnpjDigits.length !== 11 && cpfCnpjDigits.length !== 14)
      return setFormError("Informe um CPF ou CNPJ válido (necessário pra gerar o Pix)");
    setFormError(null);
    reserve.mutate();
  };

  const closeModal = () => {
    setService(null);
    setProfessional(null);
    setDate(null);
    setTime(null);
    setFormError(null);
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-background pb-28"
      style={
        {
          ...(business?.brand_primary ? { "--primary": business.brand_primary } : {}),
          ...(business?.brand_background ? { "--background": business.brand_background } : {}),
        } as React.CSSProperties
      }
    >
      <header className="bg-sidebar px-4 py-3">
        <span className="font-display text-sm font-extrabold uppercase tracking-[0.18em] text-primary">
          Agenda Agora
        </span>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4">
        <div className="flex min-h-[92px] items-center justify-center py-8">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={business?.name ? `Logotipo de ${business.name}` : "Logotipo"}
              className="max-h-24 max-w-[70%] object-contain"
            />
          ) : !isLoading && !business ? (
            <p className="text-sm text-muted-foreground">Negócio não encontrado</p>
          ) : null}
        </div>

        {business?.status === "suspenso" && (
          <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center text-sm text-destructive">
            Os agendamentos deste estabelecimento estão temporariamente indisponíveis.
          </div>
        )}

        {business?.status === "suspenso" ? null : tab === "agendar" ? (
          <div className="space-y-4">
            {(services ?? []).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setService(s);
                  setProfessional(null);
                  setDate(null);
                  setTime(null);
                  setFormError(null);
                }}
                className="w-full rounded-lg border border-border bg-card px-4 py-6 text-center transition-colors hover:border-primary"
              >
                <p className="text-lg">{s.name}</p>
                {s.show_duration && <p className="mt-3 text-sm text-muted-foreground">{s.duration_minutes}min</p>}
                {s.show_price && <p className="mt-1 text-sm text-muted-foreground">{formatPrice(s.price_cents)}</p>}
                {s.deposit_cents > 0 && (
                  <p className="mt-2 text-xs font-semibold text-primary">
                    Sinal de {formatPrice(s.deposit_cents)}
                  </p>
                )}
              </button>
            ))}
            {business && !services?.length && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhum serviço disponível no momento.
              </p>
            )}
          </div>
        ) : (
          <HistoryList
            slug={slug}
            bookings={bookings.data?.bookings ?? []}
            onOpen={setActiveCharge}
            onRefresh={() => void bookings.refetch()}
          />
        )}
      </main>

      {/* Modal de agendamento */}
      <Dialog open={!!service} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto bg-card">
          {service && (
            <div className="space-y-6 text-center">
              <div>
                <h2 className="font-display text-xl font-bold">{service.name}</h2>
                {serviceImage && <img src={serviceImage} alt={service.name} className="mx-auto mt-4 max-h-44 w-full rounded-md object-cover" />}
                {service.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{service.description}</p>
                )}
              </div>

              {!!professionals?.length && <div><p className="mb-3 text-sm font-semibold">Escolha o profissional:</p><div className="grid gap-2 sm:grid-cols-2">{professionals.map((p) => <button key={p.id} type="button" onClick={() => { setProfessional(p); setDate(null); setTime(null); }} className={`rounded-md border p-3 text-left transition-colors ${professional?.id === p.id ? "border-primary bg-primary/20" : "border-border hover:border-primary"}`}><span className="block font-semibold">{p.name}</span>{p.role && <span className="text-xs text-muted-foreground">{p.role}</span>}</button>)}</div></div>}

              {((professionals?.length ?? 0) === 0 || professional) && <div>
                <p className="mb-3 text-sm font-semibold">Selecione o dia da semana desejado:</p>
                {!days.length ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum dia de atendimento configurado.
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Dias anteriores"
                      disabled={pageStart === 0}
                      onClick={() => setPageStart(Math.max(0, pageStart - 7))}
                      className="text-muted-foreground disabled:opacity-30"
                    >
                      <ChevronLeft className="size-6" />
                    </button>
                    <div className="flex flex-1 flex-wrap justify-center gap-2">
                      {visibleDays.map((d) => (
                        <button
                          key={d.date}
                          type="button"
                          onClick={() => {
                            setDate(d.date);
                            setTime(null);
                          }}
                          className={`min-w-[5rem] rounded-md border px-3 py-2 text-sm transition-colors ${
                            date === d.date
                              ? "border-primary bg-primary/20 text-primary"
                              : "border-border hover:border-primary"
                          }`}
                        >
                          <span className="block">{ddmm(d.date)}</span>
                          <span className="block">{DAY_LABEL[d.weekday]}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      aria-label="Próximos dias"
                      disabled={pageStart + 7 >= days.length}
                      onClick={() => setPageStart(pageStart + 7)}
                      className="text-muted-foreground disabled:opacity-30"
                    >
                      <ChevronRight className="size-6" />
                    </button>
                  </div>
                )}
              </div>}

              {date && (
                <div>
                  <p className="mb-3 text-sm font-semibold">Escolha um Horário Disponível:</p>
                  {loadingSlots ? (
                    <p className="text-sm text-muted-foreground">Carregando horários...</p>
                  ) : !availability?.slots.length ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum horário livre nesse dia. Tente outra data.
                    </p>
                  ) : (
                    <div className="flex flex-wrap justify-center gap-2">
                      {availability.slots.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setTime(s)}
                          className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                            time === s
                              ? "border-primary bg-primary/20 text-primary"
                              : "border-border hover:border-primary"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {date && time && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-display text-lg font-bold">RESUMO</h3>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li className="flex items-center justify-center gap-2">
                        <Info className="size-4" /> {service.name}
                      </li>
                      <li className="flex items-center justify-center gap-2">
                        <User className="size-4" /> {professional?.name ?? "Profissional Agenda"}
                      </li>
                      <li className="flex items-center justify-center gap-2">
                        <CalendarDays className="size-4" /> {fullDate(date)}
                      </li>
                      <li className="flex items-center justify-center gap-2">
                        <Clock className="size-4" /> {time}
                      </li>
                    </ul>
                  </div>

                  {formError && (
                    <p className="rounded-md bg-destructive/20 px-3 py-2 text-sm text-destructive-foreground">
                      {formError}
                    </p>
                  )}

                  <div className="grid gap-3 text-left sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="nome">Nome e sobrenome:</Label>
                      <Input
                        id="nome"
                        placeholder="Nome e sobrenome"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="fone">Telefone:</Label>
                      <Input
                        id="fone"
                        inputMode="tel"
                        placeholder="(99)99999-9999"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="cpf">CPF ou CNPJ:</Label>
                      <Input
                        id="cpf"
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        value={cpfCnpj}
                        onChange={(e) => setCpfCnpj(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Necessário pra emitir o Pix do sinal.
                      </p>
                    </div>
                  </div>

                  <Button className="w-full" disabled={reserve.isPending} onClick={submit}>
                    AGENDAR
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Sinal de {formatPrice(service.deposit_cents)} por Pix. O horário só é confirmado
                    após o pagamento.
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {activeCharge && (
        <PaymentDialog
          chargeId={activeCharge}
          booking={bookings.data?.bookings.find((b) => b.chargeId === activeCharge) ?? null}
          onClose={() => {
            setActiveCharge(null);
            void bookings.refetch();
          }}
        />
      )}

      <nav className="fixed inset-x-0 bottom-4 mx-auto flex w-[min(28rem,90%)] items-center justify-around rounded-full border border-border bg-card py-3 shadow-lg">
        {(
          [
            { key: "agendar", label: "Agendar", icon: CalendarDays },
            { key: "historico", label: "Histórico", icon: Clock },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`flex flex-col items-center gap-1 text-xs ${
              tab === item.key
                ? "font-semibold text-foreground underline underline-offset-4"
                : "text-muted-foreground"
            }`}
          >
            <item.icon className="size-4" />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

type Booking = {
  chargeId: string;
  chargeStatus: string;
  amountCents: number;
  customerName: string | null;
  expiresAt: string | null;
  createdAt: string;
  startsAt: string | null;
  appointmentStatus: string;
  serviceName: string;
  professionalName: string;
};

function statusInfo(b: Booking) {
  if (b.chargeStatus === "pago")
    return { tag: "#Agendamento Confirmado", tone: "border-primary/60", steps: 3, last: "Confirmado" };
  if (b.chargeStatus === "pendente")
    return { tag: "#Agendamento Pendente", tone: "border-primary/40", steps: 2, last: "Aguardando Pagamento" };
  return { tag: "#Agendamento Cancelado", tone: "border-destructive/60", steps: 3, last: "Agendamento Cancelado" };
}

function HistoryList({
  slug,
  bookings,
  onOpen,
  onRefresh,
}: {
  slug: string;
  bookings: Booking[];
  onOpen: (id: string) => void;
  onRefresh: () => void;
}) {
  void slug;
  if (!bookings.length)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Seus agendamentos aparecerão aqui.
      </p>
    );

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-3">
        <p className="text-sm text-primary">Histórico de Agendamentos</p>
        <p className="text-sm text-muted-foreground">{bookings[0]?.customerName}</p>
      </div>
      {bookings.map((b) => {
        const info = statusInfo(b);
        const starts = b.startsAt ? new Date(b.startsAt) : null;
        return (
          <div key={b.chargeId} className={`rounded-xl border ${info.tone} bg-card p-4`}>
            <p className="text-xs font-semibold italic text-muted-foreground">{info.tag}</p>
            <div className="mt-3 space-y-1 rounded-lg border border-border p-3 text-sm">
              <p className="flex items-center gap-2">
                <Info className="size-4" /> {b.serviceName}
              </p>
              <p className="flex items-center gap-2">
                <CalendarDays className="size-4" />{" "}
                {starts
                  ? starts.toLocaleString("pt-BR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "America/Sao_Paulo",
                    })
                  : "—"}
              </p>
              <p className="flex items-center gap-2">
                <User className="size-4" /> {b.professionalName}
              </p>
            </div>

            <div className="mt-4 flex items-start gap-4">
              <Step icon={<History className="size-4" />} label="Agendamento Cadastrado" />
              <Step icon={<DollarSign className="size-4" />} label="Aguardando Pagamento" />
              {info.steps === 3 && (
                <Step
                  icon={
                    b.chargeStatus === "pago" ? <Check className="size-4" /> : <X className="size-4" />
                  }
                  label={info.last}
                />
              )}
            </div>

            {b.chargeStatus === "pendente" && (
              <Button
                className="mt-4 w-full"
                onClick={() => {
                  onOpen(b.chargeId);
                  onRefresh();
                }}
              >
                Pagar sinal de {formatPrice(b.amountCents)}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Step({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex w-24 flex-col items-center gap-1 text-center">
      <span className="flex size-9 items-center justify-center rounded-full border border-primary/70 text-primary">
        {icon}
      </span>
      <span className="text-[10px] leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

function PaymentDialog({
  chargeId,
  booking,
  onClose,
}: {
  chargeId: string;
  booking: Booking | null;
  onClose: () => void;
}) {
  const pixFn = useServerFn(generateDepositPix);
  const statusFn = useServerFn(getDepositStatus);
  const cancelFn = useServerFn(cancelDepositBooking);
  const [pix, setPix] = useState<{
    qrCode: string | null;
    qrCodeBase64: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [paid, setPaid] = useState(false);
  const [left, setLeft] = useState(300);

  const expiresAt = booking?.expiresAt ? new Date(booking.expiresAt).getTime() : null;

  useEffect(() => {
    const tick = () => {
      if (!expiresAt) return;
      setLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  useEffect(() => {
    if (paid) return;
    const id = setInterval(async () => {
      try {
        const r = await statusFn({ data: { chargeId } });
        if (r.status === "pago") setPaid(true);
        if (r.status === "expirado") {
          toast.error("O prazo do Pix acabou e o agendamento foi cancelado.");
          onClose();
        }
      } catch {
        /* tenta de novo */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [chargeId, paid, statusFn, onClose]);

  const generate = useMutation({
    mutationFn: () => pixFn({ data: { chargeId } }),
    onSuccess: (r) => setPix({ qrCode: r.qrCode, qrCodeBase64: r.qrCodeBase64 }),
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: () => cancelFn({ data: { chargeId } }),
    onSuccess: () => {
      toast.success("Agendamento cancelado.");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  if (paid)
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md text-center">
          <Check className="mx-auto size-10 text-primary" />
          <h2 className="font-display text-xl font-bold">Agendamento confirmado!</h2>
          <p className="text-sm text-muted-foreground">
            Sinal recebido. Seu horário está reservado.
          </p>
          <Button onClick={onClose}>Fechar</Button>
        </DialogContent>
      </Dialog>
    );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto text-center">
        <h2 className="font-display text-xl font-bold">Agendamento Aguardando Pagamento</h2>
        <p className="text-sm text-muted-foreground">
          Para confirmar seu agendamento é necessário efetuar o pagamento via pix.
        </p>
        <p className="text-sm font-semibold">Selecione a forma de pagamento desejada</p>
        <p className="text-sm text-muted-foreground">
          Clique no valor e após isso clique em &quot;Gerar Código Pix&quot; para continuar com seu
          pagamento.
        </p>
        <p className="mx-auto w-fit rounded-md bg-muted px-4 py-1 text-sm font-semibold">
          {formatPrice(booking?.amountCents ?? 0)}
        </p>
        <Button
          className="mx-auto w-fit"
          disabled={generate.isPending || !!pix}
          onClick={() => generate.mutate()}
        >
          Gerar Código Pix
        </Button>

        {pix?.qrCodeBase64 && (
          <img
            src={`data:image/png;base64,${pix.qrCodeBase64}`}
            alt="QR Code do Pix para pagar o sinal"
            className="mx-auto size-56 rounded-lg bg-white p-2"
          />
        )}
        {pix?.qrCode && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Utilize a função copia e cola de seu banco para efetuar o pagamento via pix
            </p>
            <p className="truncate rounded-md bg-muted px-3 py-2 text-left text-xs">{pix.qrCode}</p>
            <Button
              variant="secondary"
              className="mx-auto w-fit"
              onClick={() => {
                void navigator.clipboard.writeText(pix.qrCode!);
                setCopied(true);
                toast.success("Código Pix copiado!");
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copiar código
              pix
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Você tem 5 minutos para efetuar seu pagamento antes que seu agendamento seja cancelado
          automaticamente
        </p>
        <p className="font-display text-lg font-bold">
          Tempo restante: {mm}:{ss}
        </p>
        <Button variant="outline" className="mx-auto w-fit" onClick={() => setConfirmCancel(true)}>
          Cancelar pagamento
        </Button>

        <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
          <DialogContent className="max-w-sm text-center">
            <h3 className="text-base font-semibold">Pagamento Obrigatório</h3>
            <p className="text-sm">Você confirma o cancelamento desse agendamento?</p>
            <div className="flex justify-center gap-3">
              <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
                Não quero cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate()}
              >
                Sim, quero cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
