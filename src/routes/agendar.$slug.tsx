import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  DollarSign,
  History,
  Info,
  Loader2,
  MapPin,
  Phone,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import {
  getPublicBookingCatalog,
  getPublicBookingProfessionals,
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
  loader: ({ params }) => getPublicBookingCatalog({ data: { slug: params.slug } }),
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

/** Mensagem de `reserveBooking` quando o sinal efetivo é positivo e falta CPF/CNPJ. */
const DEPOSIT_DOCUMENT_REQUIRED = /CPF ou CNPJ válido para gerar o Pix/i;

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  requires_deposit: boolean;
  /** Sinal efetivo calculado no servidor (fixo ou percentual). O navegador nunca recalcula. */
  effectiveDepositCents: number;
  description: string | null;
  image_path: string | null;
  image_url: string | null;
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
  // Snapshot do sinal devolvido pela reserva, usado até o histórico trazer a cobrança.
  const [reservedAmount, setReservedAmount] = useState<{
    chargeId: string;
    amountCents: number;
  } | null>(null);
  const [confirmed, setConfirmed] = useState<{ serviceName: string; startsAt: string } | null>(
    null,
  );

  const availabilityFn = useServerFn(getAvailability);
  const openDaysFn = useServerFn(getOpenDays);
  const reserveFn = useServerFn(reserveBooking);
  const bookingsFn = useServerFn(getMyBookings);
  const professionalsFn = useServerFn(getPublicBookingProfessionals);
  const catalog = Route.useLoaderData();

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

  const business = catalog?.business ?? null;
  const services = (catalog?.services ?? []) as Service[];

  const { data: professionals } = useQuery({
    queryKey: ["public-professionals", service?.id],
    enabled: !!service,
    queryFn: () =>
      professionalsFn({ data: { slug, serviceId: service!.id } }) as Promise<Professional[]>,
  });

  const { data: openDays } = useQuery({
    queryKey: ["public-days", slug],
    queryFn: () => openDaysFn({ data: { slug } }),
  });

  const {
    data: availability,
    isFetching: loadingSlots,
    refetch: refetchAvailability,
  } = useQuery({
    queryKey: ["public-slots", slug, service?.id, professional?.id, date],
    enabled: !!service && !!date && ((professionals?.length ?? 0) === 0 || !!professional),
    queryFn: () =>
      availabilityFn({
        data: {
          slug,
          serviceId: service!.id,
          date: date!,
          professionalId: professional?.id ?? null,
        },
      }),
  });

  const bookings = useQuery({
    queryKey: ["public-bookings", slug, charges.join(",")],
    enabled: charges.length > 0,
    refetchInterval: 8000,
    queryFn: () => bookingsFn({ data: { chargeIds: charges } }),
  });

  // Valor do servidor: a disponibilidade traz o sinal atual; o catálogo cobre até ela chegar.
  const selectedDepositCents = service
    ? (availability?.depositCents ?? service.effectiveDepositCents)
    : 0;
  const needsDocument = selectedDepositCents > 0;

  const days = openDays?.days ?? [];
  const visibleDays = useMemo(() => days.slice(pageStart, pageStart + 7), [days, pageStart]);

  /**
   * O sinal mudou no servidor desde a última consulta: rebusca a disponibilidade
   * (que traz o valor atual) sem fechar o formulário. O campo de CPF/CNPJ aparece
   * ou some conforme o novo valor, e o cliente é orientado a tentar de novo.
   */
  const refreshChangedDeposit = async (options: { onlyIfZero?: boolean } = {}) => {
    const { data: fresh, isError } = await refetchAvailability();
    if (isError || !fresh) {
      if (!options.onlyIfZero)
        setFormError("Não foi possível atualizar o valor do sinal. Tente novamente.");
      return;
    }
    if (options.onlyIfZero && fresh.depositCents > 0) return;
    const message =
      fresh.depositCents > 0
        ? `O sinal deste serviço foi atualizado para ${formatPrice(fresh.depositCents)}. Informe seu CPF ou CNPJ e toque em Agendar novamente.`
        : "O sinal deste serviço foi atualizado e não é mais cobrado. Toque em Agendar novamente.";
    setFormError(message);
    toast.info(message);
  };

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
          // Sem sinal, o documento não é pedido nem enviado.
          ...(needsDocument ? { customerCpfCnpj: cpfCnpj.trim() } : {}),
          professionalId: professional?.id ?? null,
        },
      }),
    onSuccess: (r) => {
      setService(null);
      setProfessional(null);
      setDate(null);
      setTime(null);
      setPageStart(0);
      if (r.chargeId) {
        saveCharge(r.chargeId);
        setReservedAmount({ chargeId: r.chargeId, amountCents: r.amountCents });
        setActiveCharge(r.chargeId);
        setTab("historico");
        void bookings.refetch();
      } else {
        setConfirmed({ serviceName: r.serviceName, startsAt: r.startsAt });
      }
    },
    onError: (e: Error) => {
      // O servidor passou a cobrar sinal e pediu o documento que a tela não exibia.
      if (DEPOSIT_DOCUMENT_REQUIRED.test(e.message)) {
        void refreshChangedDeposit();
        return;
      }
      setFormError(e.message);
      toast.error(e.message);
    },
  });

  const submit = () => {
    if (name.trim().length < 2) return setFormError("Informe o seu nome e sobrenome");
    if (phone.trim().length < 8) return setFormError("Informe o seu telefone");
    const cpfCnpjDigits = cpfCnpj.replace(/\D/g, "");
    if (needsDocument && cpfCnpjDigits.length !== 11 && cpfCnpjDigits.length !== 14) {
      setFormError("Informe um CPF ou CNPJ válido (necessário pra gerar o Pix)");
      // O sinal pode ter sido zerado desde a consulta: se sim, a exigência some.
      void refreshChangedDeposit({ onlyIfZero: true });
      return;
    }
    setFormError(null);
    reserve.mutate();
  };

  const openService = (selected: Service) => {
    setService(selected);
    setProfessional(null);
    setDate(null);
    setTime(null);
    setPageStart(0);
    setFormError(null);
  };

  const closeService = () => {
    setService(null);
    setProfessional(null);
    setDate(null);
    setTime(null);
    setPageStart(0);
    setFormError(null);
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-background pb-28 text-foreground"
      style={
        {
          ...(business?.brand_primary ? { "--primary": business.brand_primary } : {}),
          ...(business?.brand_background ? { "--background": business.brand_background } : {}),
        } as React.CSSProperties
      }
    >
      <header className="border-b border-border/40 bg-sidebar px-4 py-3">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
          <span className="font-display text-sm font-extrabold uppercase tracking-[0.18em] text-primary">
            Agenda Agora
          </span>
          {business?.phone ? (
            <a
              href={`tel:${business.phone}`}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Phone className="size-3.5" /> Contato
            </a>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-8">
        {!business ? (
          <div className="flex min-h-[50vh] items-center justify-center py-10">
            <p className="text-sm text-muted-foreground">Negócio não encontrado</p>
          </div>
        ) : (
          <>
            <BusinessHeader
              name={business.name}
              logoUrl={business.logo_url ?? null}
              address={business.address}
            />

            {business.status === "suspenso" ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-center text-sm text-destructive">
                Os agendamentos deste estabelecimento estão temporariamente indisponíveis.
              </div>
            ) : tab === "agendar" ? (
              <div className="space-y-8">
                {services?.length ? (
                  <ServiceSection services={services} onSelect={openService} />
                ) : (
                  <div className="rounded-xl border border-border bg-card p-8 text-center">
                    <p className="font-semibold">Nenhum serviço disponível no momento.</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Volte mais tarde para conferir novos horários e serviços.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <HistoryList
                bookings={bookings.data?.bookings ?? []}
                onOpen={setActiveCharge}
                onRefresh={() => void bookings.refetch()}
              />
            )}
          </>
        )}
      </main>

      {/* Modal de agendamento */}
      <Dialog open={!!service} onOpenChange={(o) => !o && closeService()}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto bg-card p-0">
          {service && (
            <div className="space-y-6 p-5 text-center sm:p-6">
              <div>
                {service.image_url && (
                  <img
                    src={service.image_url}
                    alt={service.name}
                    loading="lazy"
                    decoding="async"
                    className="mx-auto mb-5 max-h-52 w-full rounded-lg object-cover"
                  />
                )}
                <h2 className="font-display text-xl font-bold">{service.name}</h2>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  {service.show_price ? <span>{formatPrice(service.price_cents)}</span> : null}
                  {service.show_price && service.show_duration ? <span>·</span> : null}
                  {service.show_duration ? <span>{service.duration_minutes}min</span> : null}
                </div>
                {service.description && (
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                    {service.description}
                  </p>
                )}
              </div>

              {!!professionals?.length && (
                <div>
                  <p className="mb-3 text-sm font-semibold">Escolha o profissional</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {professionals.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setProfessional(p);
                          setDate(null);
                          setTime(null);
                          setPageStart(0);
                        }}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          professional?.id === p.id
                            ? "border-primary bg-primary/15 text-foreground"
                            : "border-border bg-background/30 hover:border-primary"
                        }`}
                      >
                        <span className="block font-semibold">{p.name}</span>
                        {p.role && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {p.role}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {((professionals?.length ?? 0) === 0 || professional) && (
                <div>
                  <p className="mb-3 text-sm font-semibold">Escolha a data</p>
                  {!days.length ? (
                    <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                      Nenhum dia de atendimento está disponível no momento.
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Datas anteriores"
                        disabled={pageStart === 0}
                        onClick={() => setPageStart(Math.max(0, pageStart - 7))}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
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
                            className={`min-w-[4.75rem] rounded-lg border px-3 py-2 text-sm transition-colors ${
                              date === d.date
                                ? "border-primary bg-primary/15 text-primary"
                                : "border-border bg-background/30 hover:border-primary"
                            }`}
                          >
                            <span className="block font-semibold">{ddmm(d.date)}</span>
                            <span className="mt-0.5 block text-[11px] opacity-80">
                              {DAY_LABEL[d.weekday]}
                            </span>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        aria-label="Próximas datas"
                        disabled={pageStart + 7 >= days.length}
                        onClick={() => setPageStart(pageStart + 7)}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronRight className="size-6" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {date && (
                <div>
                  <p className="mb-3 text-sm font-semibold">Escolha um horário disponível</p>
                  {loadingSlots ? (
                    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Carregando horários...
                    </p>
                  ) : !availability?.slots.length ? (
                    <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                      Nenhum horário livre nesta data. Escolha outro dia.
                    </p>
                  ) : (
                    <div className="flex flex-wrap justify-center gap-2">
                      {availability.slots.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setTime(s)}
                          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                            time === s
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border bg-background/30 hover:border-primary"
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
                <div className="space-y-4 border-t border-border pt-5">
                  <div>
                    <h3 className="font-display text-base font-bold uppercase tracking-wide">
                      Resumo
                    </h3>
                    <div className="mx-auto mt-3 max-w-sm space-y-2 rounded-lg border border-border bg-background/30 p-4 text-left text-sm">
                      <p className="flex items-center gap-2">
                        <Info className="size-4 shrink-0 text-primary" /> {service.name}
                      </p>
                      <p className="flex items-center gap-2">
                        <User className="size-4 shrink-0 text-primary" />{" "}
                        {professional?.name ?? "Profissional Agenda"}
                      </p>
                      <p className="flex items-center gap-2">
                        <CalendarDays className="size-4 shrink-0 text-primary" /> {fullDate(date)}
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock className="size-4 shrink-0 text-primary" /> {time}
                      </p>
                    </div>
                  </div>

                  {formError && (
                    <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {formError}
                    </p>
                  )}

                  <div className="grid gap-3 text-left sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="nome">Nome e sobrenome</Label>
                      <Input
                        id="nome"
                        autoComplete="name"
                        placeholder="Nome e sobrenome"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="fone">Telefone</Label>
                      <Input
                        id="fone"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="(99) 99999-9999"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    {needsDocument && (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="cpf">CPF ou CNPJ</Label>
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
                    )}
                  </div>

                  <Button className="w-full" disabled={reserve.isPending} onClick={submit}>
                    {reserve.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Agendando...
                      </>
                    ) : (
                      "Agendar"
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {needsDocument
                      ? `Sinal de ${formatPrice(selectedDepositCents)} por Pix. O horário só é confirmado após o pagamento.`
                      : "Este serviço não exige sinal. O horário é confirmado ao finalizar."}
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
          reservedAmountCents={
            reservedAmount?.chargeId === activeCharge ? reservedAmount.amountCents : null
          }
          onClose={() => {
            setActiveCharge(null);
            void bookings.refetch();
          }}
        />
      )}

      {confirmed && <ConfirmedDialog booking={confirmed} onClose={() => setConfirmed(null)} />}

      <nav className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[min(28rem,90%)] items-center justify-around rounded-full border border-border bg-card/95 py-3 shadow-lg backdrop-blur">
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
            className={`flex min-w-24 flex-col items-center gap-1 text-xs transition-colors ${
              tab === item.key
                ? "font-semibold text-foreground underline underline-offset-4"
                : "text-muted-foreground hover:text-foreground"
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

function BusinessHeader({
  name,
  logoUrl,
  address,
}: {
  name: string;
  logoUrl: string | null;
  address: string | null;
}) {
  return (
    <div className="py-8 text-center">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`Logotipo de ${name}`}
          decoding="async"
          fetchPriority="high"
          className="mx-auto max-h-24 max-w-[72%] object-contain"
        />
      ) : (
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-xl font-bold text-primary">
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <h1 className="mt-4 text-xl font-semibold">{name}</h1>
      {address ? (
        <p className="mx-auto mt-2 flex max-w-md items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" /> {address}
        </p>
      ) : null}
    </div>
  );
}

function ServiceSection({
  services,
  onSelect,
}: {
  services: Service[];
  onSelect: (service: Service) => void;
}) {
  return (
    <section>
      <h2 className="mb-3 text-center text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">
        Serviços
      </h2>
      <div className="space-y-3">
        {services.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s)}
            className="w-full rounded-lg border border-border bg-card px-4 py-5 text-center text-card-foreground transition-colors hover:border-primary"
          >
            <p className="text-base font-medium">{s.name}</p>
            {(s.show_price || s.show_duration) && (
              <p className="mt-2 text-sm text-muted-foreground">
                {s.show_price ? formatPrice(s.price_cents) : null}
                {s.show_price && s.show_duration ? " - " : null}
                {s.show_duration ? `${s.duration_minutes}min` : null}
              </p>
            )}
            {s.effectiveDepositCents > 0 ? (
              <p className="mt-2 text-xs font-semibold text-primary">
                Sinal de {formatPrice(s.effectiveDepositCents)}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Sem sinal</p>
            )}
          </button>
        ))}
      </div>
    </section>
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
    return {
      tag: "#Agendamento Confirmado",
      tone: "border-primary/60",
      label: "Confirmado",
      steps: 3,
    };
  if (b.chargeStatus === "pendente")
    return {
      tag: "#Agendamento Pendente",
      tone: "border-primary/40",
      label: "Aguardando pagamento",
      steps: 2,
    };
  return {
    tag: "#Agendamento Cancelado",
    tone: "border-destructive/60",
    label: "Cancelado",
    steps: 3,
  };
}

function HistoryList({
  bookings,
  onOpen,
  onRefresh,
}: {
  bookings: Booking[];
  onOpen: (id: string) => void;
  onRefresh: () => void;
}) {
  if (!bookings.length)
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <History className="mx-auto size-7 text-muted-foreground" />
        <p className="mt-3 font-semibold">Nenhum agendamento por aqui ainda.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Seus agendamentos feitos neste aparelho aparecerão aqui.
        </p>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="border-b border-border pb-3">
        <p className="text-sm font-semibold text-primary">Histórico de agendamentos</p>
        {bookings[0]?.customerName ? (
          <p className="text-sm text-muted-foreground">{bookings[0].customerName}</p>
        ) : null}
      </div>
      {bookings.map((b) => {
        const info = statusInfo(b);
        const starts = b.startsAt ? new Date(b.startsAt) : null;
        return (
          <article key={b.chargeId} className={`rounded-xl border ${info.tone} bg-card p-4`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold italic text-muted-foreground">{info.tag}</p>
              <span className="rounded-full border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">
                {info.label}
              </span>
            </div>
            <div className="mt-3 space-y-2 rounded-lg border border-border bg-background/20 p-3 text-sm">
              <p className="flex items-center gap-2">
                <Info className="size-4 text-primary" /> {b.serviceName}
              </p>
              <p className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" />{" "}
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
                <User className="size-4 text-primary" /> {b.professionalName}
              </p>
            </div>

            <div className="mt-4 flex items-start justify-center gap-4">
              <Step icon={<History className="size-4" />} label="Agendamento cadastrado" />
              <Step icon={<DollarSign className="size-4" />} label="Pagamento do sinal" />
              {info.steps === 3 && (
                <Step
                  icon={
                    b.chargeStatus === "pago" ? (
                      <Check className="size-4" />
                    ) : (
                      <X className="size-4" />
                    )
                  }
                  label={info.label}
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
          </article>
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

function ConfirmedDialog({
  booking,
  onClose,
}: {
  booking: { serviceName: string; startsAt: string };
  onClose: () => void;
}) {
  const starts = new Date(booking.startsAt);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm bg-card text-center">
        <div className="space-y-4 p-2">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Check className="size-7" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold">Agendamento confirmado!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Este serviço não exige sinal — seu horário já está garantido.
            </p>
          </div>
          <div className="space-y-2 rounded-lg border border-border bg-background/30 p-4 text-left text-sm">
            <p className="flex items-center gap-2">
              <Info className="size-4 shrink-0 text-primary" /> {booking.serviceName}
            </p>
            <p className="flex items-center gap-2">
              <CalendarDays className="size-4 shrink-0 text-primary" />{" "}
              {starts.toLocaleString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Sao_Paulo",
              })}
            </p>
          </div>
          <Button className="w-full" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  chargeId,
  booking,
  reservedAmountCents,
  onClose,
}: {
  chargeId: string;
  booking: Booking | null;
  reservedAmountCents: number | null;
  onClose: () => void;
}) {
  // Snapshot gravado no servidor (deposit_payments.amount_cents); nada é recalculado aqui.
  const amountCents = booking?.amountCents ?? reservedAmountCents;
  const pixFn = useServerFn(generateDepositPix);
  const statusFn = useServerFn(getDepositStatus);
  const cancelFn = useServerFn(cancelDepositBooking);
  const generatingPix = useRef(false);
  const [pix, setPix] = useState<{
    qrCode: string;
    qrCodeBase64: string;
  } | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
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
    mutationFn: async () => {
      const result = await pixFn({ data: { chargeId } });
      const qrCode = result.qrCode?.trim();
      const qrCodeBase64 = result.qrCodeBase64?.trim();
      if (
        !qrCode ||
        !qrCodeBase64 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(qrCodeBase64)
      ) {
        throw new Error("O código Pix ainda não está disponível. Tente novamente.");
      }
      return { qrCode, qrCodeBase64 };
    },
    onSuccess: (result) => {
      setPix(result);
      setPixError(null);
    },
    onError: (error: Error) => {
      setPix(null);
      const message = error.message;
      if (/prazo|expirad|não está mais ativa/i.test(message)) {
        setPixError("O prazo desta reserva terminou. Faça um novo agendamento.");
      } else if (/não está habilitado|subconta|análise/i.test(message)) {
        setPixError("Este estabelecimento ainda não pode receber Pix. Entre em contato com ele.");
      } else {
        setPixError("Não foi possível gerar o Pix agora. Tente novamente.");
      }
    },
    onSettled: () => {
      generatingPix.current = false;
    },
  });

  const requestPix = () => {
    if (generatingPix.current || generate.isPending || pix) return;
    generatingPix.current = true;
    setPixError(null);
    generate.mutate();
  };

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
        <h2 className="font-display text-xl font-bold">Agendamento aguardando pagamento</h2>
        <p className="text-sm text-muted-foreground">
          Para confirmar seu agendamento, efetue o pagamento do sinal via Pix.
        </p>
        <p className="mx-auto w-fit rounded-md bg-muted px-4 py-1 text-sm font-semibold">
          {amountCents === null ? "Carregando valor do sinal..." : formatPrice(amountCents)}
        </p>
        <Button
          className="mx-auto w-fit"
          disabled={generate.isPending || !!pix}
          onClick={requestPix}
          aria-busy={generate.isPending}
        >
          {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {generate.isPending
            ? "Gerando código Pix..."
            : pixError
              ? "Tentar novamente"
              : "Gerar código Pix"}
        </Button>
        {pixError && (
          <p role="alert" className="text-sm text-destructive">
            {pixError}
          </p>
        )}

        {pix && (
          <div className="min-w-0 space-y-2">
            <img
              src={`data:image/png;base64,${pix.qrCodeBase64}`}
              alt="QR Code do Pix para pagar o sinal"
              decoding="async"
              className="mx-auto size-56 rounded-lg bg-white p-2"
              onError={() => {
                setPix(null);
                setPixError("O QR Code do Pix não pôde ser exibido. Tente novamente.");
              }}
            />
            {amountCents !== null && (
              <p className="text-sm font-medium">Valor do Pix: {formatPrice(amountCents)}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Use a função Pix copia e cola do seu banco para concluir o pagamento.
            </p>
            <p className="min-w-0 truncate rounded-md bg-muted px-3 py-2 text-left text-xs">
              {pix.qrCode}
            </p>
            <Button
              variant="secondary"
              className="mx-auto w-fit"
              onClick={() => {
                void navigator.clipboard.writeText(pix.qrCode);
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
