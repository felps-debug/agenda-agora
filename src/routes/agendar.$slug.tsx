import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { friendlyError } from "@/lib/error-page";
import {
  canRenderRescheduleForm,
  formatAppointmentDateTime,
  shouldRenderDepositStep,
} from "@/lib/booking-history";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Clock,
  DollarSign,
  Heart,
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
import { accessibleTextColor } from "@/lib/contrast";
import {
  DEFAULT_PANEL1_APPEARANCE,
  type Panel1Appearance,
  type Panel1Preferences,
} from "@/lib/panel1-config";
import { loadOutreachFont, outreachFontFamily } from "@/components/template-editor/fonts";
import {
  getPublicBookingCatalog,
  getPublicBookingProfessionals,
  getAvailability,
  getOpenDays,
  reserveBooking,
  getMyBookings,
  cancelAppointmentPublic,
  rescheduleAppointmentPublic,
} from "@/lib/booking.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BusinessHeader, CategoryServiceGroup, ServiceSection } from "@/components/public-booking/appearance-preview";
import {
  ElegancePanel,
  EleganceServiceList,
} from "@/components/public-booking/elegance";
import { EleganceBookingDialog } from "@/components/public-booking/elegance-booking";
import type { EleganceHistoryBooking } from "@/components/public-booking/elegance-history";
import { EleganceHistoryList } from "@/components/public-booking/elegance-history";
import { CookieBanner } from "@/components/public-booking/CookieBanner";


const PaymentDialog = lazy(() => import("@/components/public-booking/PaymentDialog"));

export const Route = createFileRoute("/agendar/$slug")({
  loader: ({ params }) => getPublicBookingCatalog({ data: { slug: params.slug } }),
  staleTime: 0,
  preloadStaleTime: 0,
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
  category_id?: string | null;
};

type Professional = { id: string; name: string; role: string | null; avatar_url: string | null };

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

function publicCodesStorageKey(slug: string) {
  return `agenda-servico:${slug}:booking-codes`;
}

function readPublicCodes(slug: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(publicCodesStorageKey(slug));
    const value: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(value)
      ? value.filter((code): code is string => typeof code === "string")
      : [];
  } catch {
    return [];
  }
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

/** Serviços agrupados por categoria ativa (colapsada); sem categoria, lista direta. */
function GroupedServices({
  services,
  categories,
  onSelect,
  appearance,
  pageText,
}: {
  services: Service[];
  categories: Array<{ id: string; name: string; position: number }>;
  onSelect: (service: Service) => void;
  appearance: Panel1Appearance;
  pageText: string;
}) {
  const byCategory = new Map<string, Service[]>();
  const ungrouped: Service[] = [];
  for (const s of services) {
    const cat = categories.find((c) => c.id === s.category_id);
    if (cat) {
      const list = byCategory.get(cat.id) ?? [];
      list.push(s);
      byCategory.set(cat.id, list);
    } else {
      ungrouped.push(s);
    }
  }
  const groups = categories.filter((c) => (byCategory.get(c.id) ?? []).length > 0);
  if (groups.length === 0) {
    return (
      <>
        <h2
          className="mb-3 text-left text-[15px] font-semibold sm:text-[18px]"
          style={{ color: pageText, fontFamily: "'Inter', sans-serif" }}
        >
          Nossos Serviços
        </h2>
        <ServiceSection
          services={services}
          onSelect={onSelect}
          appearance={appearance}
          pageText={pageText}
        />
      </>
    );
  }
  return (
    <div className="space-y-8">
      <h2
        className="mb-3 text-left text-[15px] font-semibold sm:text-[18px]"
        style={{ color: pageText, fontFamily: "'Inter', sans-serif" }}
      >
        Nossos Serviços
      </h2>
      <div className="space-y-3">
        {groups.map((c) => (
          <CategoryServiceGroup
            key={c.id}
            name={c.name}
            services={byCategory.get(c.id) ?? []}
            onSelect={onSelect}
            appearance={appearance}
          />
        ))}
      </div>
      {ungrouped.length > 0 ? (
        <ServiceSection
          services={ungrouped}
          onSelect={onSelect}
          appearance={appearance}
          pageText={pageText}
          title="Outros serviços"
        />
      ) : null}
    </div>
  );
}

function PublicBooking() {
  const { slug } = Route.useParams();
  const [tab, setTab] = useState<"agendar" | "historico" | "perfil">("agendar");
  const [service, setService] = useState<Service | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pageStart, setPageStart] = useState(0);
  const [charges, setCharges] = useState<string[]>([]);
  const [publicCodes, setPublicCodes] = useState<string[]>([]);
  const [exitStage, setExitStage] = useState<"hidden" | "shown" | "hiding">("hidden");
  const [activeCharge, setActiveCharge] = useState<string | null>(null);

  const handleClientLogout = () => {
    try {
      document.cookie.split(";").forEach((c) => {
        const name = c.split("=")[0]?.trim();
        if (name) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        }
      });
      window.localStorage.removeItem(`agenda-servico:${slug}:charges`);
      window.localStorage.removeItem(`agenda-servico:${slug}:booking-codes`);
      window.localStorage.removeItem("aa-cookie-consent-v1");
      window.sessionStorage.clear();
    } catch {
      // Sem armazenamento: segue com o feedback visual.
    }
    setExitStage("shown");
    window.setTimeout(() => setExitStage("hiding"), 2500);
    window.setTimeout(() => {
      setExitStage("hidden");
      // Reabre limpo após a saída.
      window.location.reload();
    }, 3000);
  };
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
  const cancelAppointmentFn = useServerFn(cancelAppointmentPublic);
  const rescheduleAppointmentFn = useServerFn(rescheduleAppointmentPublic);
  const professionalsFn = useServerFn(getPublicBookingProfessionals);
  const catalog = Route.useLoaderData();

  useEffect(() => {
    setCharges(readCharges(slug));
    setPublicCodes(readPublicCodes(slug));
  }, [slug]);

  const saveCharge = useCallback(
    (id: string) => {
      const next = [id, ...readCharges(slug)].slice(0, 30);
      window.localStorage.setItem(storageKey(slug), JSON.stringify(next));
      setCharges(next);
    },
    [slug],
  );

  const savePublicCode = useCallback(
    (publicCode: string) => {
      try {
        const next = [
          publicCode,
          ...readPublicCodes(slug).filter((code) => code !== publicCode),
        ].slice(0, 30);
        window.localStorage.setItem(publicCodesStorageKey(slug), JSON.stringify(next));
        setPublicCodes(next);
      } catch {
        toast.error("Não foi possível salvar este agendamento neste aparelho.");
      }
    },
    [slug],
  );

  const business = catalog?.business ?? null;
  const appearance: Panel1Appearance = {
    ...DEFAULT_PANEL1_APPEARANCE,
    ...(catalog?.appearance ?? {}),
  };
  const pageBackground = business?.brand_background ?? "#ffffff";
  const pageBackgroundImage = business?.brand_background_image ?? null;
  const pageText = accessibleTextColor(pageBackground);
  const pageFontFamily = outreachFontFamily(appearance.font_family);

  useEffect(() => {
    loadOutreachFont(appearance.font_family);
  }, [appearance.font_family]);

  // Os dois modelos usam o mesmo painel público. O Minimalista mantém sua
  // identificação/configuração, mas compartilha a renderização do Elegance
  // para que editor e página de agendamento permaneçam idênticos.
  const layoutKey = catalog?.visual?.layout_key ?? "classic";
  const isMinimalist = layoutKey === "classic";
  const isElegance = true;
  useEffect(() => {
    if (isElegance) loadOutreachFont("playfair-display");
  }, [isElegance]);
  const agendaText = accessibleTextColor(appearance.agenda_background);
  const modalText = accessibleTextColor(appearance.modal_background);
  const modalHoverText = accessibleTextColor(appearance.modal_hover_background);
  const modalActiveText = accessibleTextColor(appearance.modal_active_background);
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
    isError: slotsError,
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
    queryKey: ["public-bookings", slug, charges.join(","), publicCodes.join(",")],
    enabled: charges.length > 0 || publicCodes.length > 0,
    refetchInterval: (query) => {
      const rows = query.state.data?.bookings;
      return !rows?.length || rows.some((booking) => booking.chargeStatus === "pendente")
        ? 15_000
        : false;
    },
    refetchIntervalInBackground: false,
    queryFn: () => bookingsFn({ data: { chargeIds: charges, publicCodes } }),
  });

  const cancelAppointment = useMutation({
    mutationFn: (publicCode: string) => cancelAppointmentFn({ data: { publicCode } }),
    onSuccess: () => {
      toast.success("Agendamento cancelado.");
      void bookings.refetch();
    },
    onError: (error: Error) => toast.error(friendlyError(error)),
  });
  const rescheduleAppointment = useMutation({
    mutationFn: (input: { publicCode: string; date: string; time: string }) =>
      rescheduleAppointmentFn({ data: input }),
    onSuccess: () => {
      toast.success("Agendamento remarcado.");
      void bookings.refetch();
    },
    onError: (error: Error) => toast.error(friendlyError(error)),
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
          // Sem sinal, documento e e-mail do pagador não são pedidos nem enviados.
          ...(needsDocument
            ? { customerEmail: email.trim(), customerCpfCnpj: cpfCnpj.trim() }
            : {}),
          professionalId: professional?.id ?? null,
        },
      }),
    onSuccess: (r) => {
      savePublicCode(r.publicCode);
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
      const message = friendlyError(e, "salvar o agendamento");
      setFormError(message);
      toast.error(message);
    },
  });

  const submit = () => {
    if (name.trim().length < 2) return setFormError("Informe o seu nome e sobrenome");
    if (phone.trim().length < 8) return setFormError("Informe o seu telefone");
    if (needsDocument && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError("Informe um e-mail válido (necessário pra gerar o Pix)");
      return;
    }
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
      className={`public-booking flex min-h-screen flex-col overflow-x-clip bg-background text-foreground ${isElegance ? "" : "pb-28"}`}
      style={
        {
          ...(business?.brand_primary ? { "--primary": business.brand_primary } : {}),
          "--background": pageBackground,
          "--foreground": pageText,
          "--card": pageBackground,
          "--card-foreground": pageText,
          "--primary-foreground": accessibleTextColor(business?.brand_primary ?? "#2563eb"),
          backgroundColor: pageBackground,
          color: pageText,
          fontFamily: `'${pageFontFamily}', sans-serif`,
          ...(pageBackgroundImage && !isElegance
            ? {
                backgroundImage: `url(${pageBackgroundImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundAttachment: "fixed",
              }
            : {}),
        } as React.CSSProperties
      }
    >
      {isElegance && business ? (
        <ElegancePanel
          appearance={appearance}
          brandName={business.name}
          title={tab === "historico" ? "Meus agendamentos" : null}
          logoUrl={business.logo_url}
          coverUrl={pageBackgroundImage}
          pageBackground={pageBackground}
          activeTab={tab === "perfil" ? "agendar" : tab}
          onTabSelect={setTab}
          onLogout={handleClientLogout}
          fixedFooter
          minimalist={isMinimalist}
         >
          {business.status === "suspenso" ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-center text-sm text-destructive">
              Os agendamentos deste estabelecimento estão temporariamente indisponíveis.
            </div>
          ) : tab === "agendar" ? (
            <EleganceServiceList
              services={services}
              onSelect={openService}
              appearance={appearance}
            />
          ) : (
            <EleganceHistoryList
              slug={slug}
              bookings={(bookings.data?.bookings ?? []) as EleganceHistoryBooking[]}
              appearance={appearance}
              modalText={modalText}
              timezone={catalog?.preferences?.timezone ?? "America/Sao_Paulo"}
              serviceImageUrl={(serviceId) =>
                services.find((s) => s.id === serviceId)?.image_url ?? null
              }
              cancellationEnabled={!!catalog?.preferences?.cancellations_enabled}
              rescheduleEnabled={!!catalog?.preferences?.reschedule_enabled}
              cancelPending={cancelAppointment.isPending}
              reschedulePending={rescheduleAppointment.isPending}
              onCancel={(code) => cancelAppointment.mutate(code)}
              onReschedule={async (input) => {
                await rescheduleAppointment.mutateAsync(input);
              }}
              onOpenCharge={setActiveCharge}
            />
          )}
        </ElegancePanel>
      ) : (
      <>
        <header className="px-4 pt-5">
            <div className="mx-auto w-full max-w-2xl text-center">
              <span className="text-[0.9375rem] font-semibold uppercase tracking-[0.2em]">
                Agenda Agora
              </span>
            </div>
          </header>

          <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-8">
            {!business ? (
              <div className="flex min-h-[50vh] items-center justify-center py-10">
                <p className="text-sm">Negócio não encontrado</p>
              </div>
            ) : business.status === "suspenso" ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-center text-sm text-destructive">
                Os agendamentos deste estabelecimento estão temporariamente indisponíveis.
              </div>
            ) : tab === "agendar" ? (
              <div className="space-y-8">
                <BusinessHeader
                  name={business.name}
                  logoUrl={business.logo_url}
                  appearance={appearance}
                />
                {services?.length ? (
                  <GroupedServices
                    services={services}
                    categories={(catalog?.categories ?? []) as Array<{
                      id: string;
                      name: string;
                      position: number;
                    }>}
                    onSelect={openService}
                    appearance={appearance}
                    pageText={pageText}
                  />
                ) : (
                  <div className="rounded-xl border border-border bg-card p-8 text-center">
                    <p className="font-semibold">Nenhum serviço disponível no momento.</p>
                    <p className="mt-2 text-sm">
                      Volte mais tarde para conferir novos horários e serviços.
                    </p>
                  </div>
                )}
              </div>
            ) : tab === "perfil" ? (
              <div className="flex flex-col items-center gap-6 py-4 text-center">
                {business.logo_url ? (
                  <img
                    src={business.logo_url}
                    alt={`Logotipo de ${business.name}`}
                    decoding="async"
                    className="mx-auto max-h-28 object-contain"
                  />
                ) : null}
                <h2 className="text-2xl font-semibold">{business.name}</h2>
                {business.phone || business.address ? (
                  <div
                    className="w-full overflow-hidden rounded-xl border text-left"
                    style={{
                      backgroundColor: appearance.service_background,
                      borderColor: appearance.service_border,
                      color: appearance.service_text,
                    }}
                  >
                    {business.phone ? (
                      <a
                        href={`tel:${business.phone}`}
                        className="flex items-center gap-3 px-5 py-4 text-sm"
                        style={{ borderColor: appearance.service_border, borderBottomWidth: business.address ? 1 : 0 }}
                      >
                        <Phone className="size-4 shrink-0" /> {business.phone}
                      </a>
                    ) : null}
                    {business.address ? (
                      <p className="flex items-center gap-3 px-5 py-4 text-sm">
                        <MapPin className="size-4 shrink-0" /> {business.address}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <HistoryList
                slug={slug}
                bookings={bookings.data?.bookings ?? []}
                onOpen={setActiveCharge}
                onRefresh={() => void bookings.refetch()}
                appearance={appearance}
                pageText={pageText}
                {...(catalog?.preferences ? { preferences: catalog.preferences } : {})}
                onCancel={(code) => cancelAppointment.mutate(code)}
                onReschedule={async (input) => {
                  await rescheduleAppointment.mutateAsync(input);
                }}
                cancelPending={cancelAppointment.isPending}
                reschedulePending={rescheduleAppointment.isPending}
              />
            )}
          </main>
        </>
      )}
      {/* Modal de agendamento */}
      <Dialog open={!!service} onOpenChange={(o) => !o && closeService()}>
        {isElegance && service ? (
          <EleganceBookingDialog
            minimalist={isMinimalist}
            service={service}
            appearance={appearance}
            pageBackground={pageBackground}
            modalText={modalText}
            modalActiveText={modalActiveText}
            onClose={closeService}
            professionals={professionals ?? []}
            professional={professional}
            onProfessionalChange={(next) => {
              setProfessional(next ? { ...next, avatar_url: next.avatar_url ?? null } : null);
              setTime(null);
            }}
            days={days}
            date={date}
            onDateSelect={(next) => {
              setDate(next);
              setTime(null);
              // Seleciona o primeiro profissional automaticamente para que
              // a caixa de profissional e a grade de horários abram juntas.
              const primeiro = professionals?.[0];
              if (!professional && primeiro) {
                setProfessional({ ...primeiro, avatar_url: primeiro.avatar_url ?? null });
              }
            }}
            time={time}
            onTimeSelect={setTime}
            slots={availability?.slots ?? []}
            slotsLoading={loadingSlots}
            slotsError={slotsError}
            formName={name}
            onNameChange={setName}
            formPhone={phone}
            onPhoneChange={setPhone}
            formEmail={email}
            onEmailChange={setEmail}
            formCpfCnpj={cpfCnpj}
            onCpfCnpjChange={setCpfCnpj}
            needsDocument={needsDocument}
            formError={formError}
            pending={reserve.isPending}
            onSubmit={submit}
            noteText={
              needsDocument
                ? `Sinal de ${formatPrice(selectedDepositCents)} por Pix. O horário só é confirmado após o pagamento.`
                : "Este serviço não exige sinal. O horário é confirmado ao finalizar."
            }
          />
        ) : (
        <DialogContent
          className={`max-h-[92vh] max-w-lg overflow-y-auto p-0 ${
            ""
          }`}
          style={{
            backgroundColor: appearance.modal_background,
            color: modalText,
            borderColor: appearance.modal_border,
          }}
        >
          {service && (
            <div className="space-y-6 p-5 text-center sm:p-6">
              <div>
                <div
                  className="overflow-hidden rounded-xl border"
                  style={{
                    borderColor: appearance.modal_border,
                    backgroundColor: appearance.modal_background,
                  }}
                >
                  {service.image_url && (
                    <img
                      src={service.image_url}
                      alt={service.name}
                      loading="lazy"
                      decoding="async"
                      className="h-44 w-full object-cover"
                    />
                  )}
                  <div className="p-4 text-center">
                    <h3 className="text-xl font-bold tracking-tight">{service.name}</h3>
                    {(service.show_price || service.show_duration) && (
                      <p className="mt-1 text-sm font-medium opacity-80">
                        {service.show_price ? formatPrice(service.price_cents) : null}
                        {service.show_price && service.show_duration ? " • " : null}
                        {service.show_duration ? `${service.duration_minutes}min` : null}
                      </p>
                    )}
                  </div>
                </div>
                {service.description && (
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed">
                    {service.description}
                  </p>
                )}
              </div>

              {!!professionals?.length && (
                <div>
                  <p className="mb-3 block text-xs font-semibold uppercase tracking-wider opacity-60">
                    Escolha o profissional
                  </p>
                  <div className="space-y-2">
                    {professionals.map((p) => {
                      const selected = professional?.id === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setProfessional(p);
                            setDate(null);
                            setTime(null);
                            setPageStart(0);
                          }}
                          className="flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all active:scale-[0.99]"
                          style={
                            {
                              borderColor: selected
                                ? appearance.modal_border
                                : appearance.modal_border,
                              backgroundColor: selected
                                ? appearance.modal_active_background
                                : appearance.modal_background,
                              color: selected ? modalActiveText : modalText,
                              "--modal-hover-background": appearance.modal_hover_background,
                              "--modal-hover-text": modalHoverText,
                            } as React.CSSProperties
                          }
                          data-selected={selected}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold capitalize">{p.name}</p>
                            {p.role && (
                              <p className="truncate text-xs capitalize opacity-70">{p.role}</p>
                            )}
                          </div>
                          <span
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                            style={{
                              borderColor: selected
                                ? "currentColor"
                                : appearance.modal_border,
                            }}
                          >
                            {selected ? (
                              <span className="h-2 w-2 rounded-full bg-current" />
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {((professionals?.length ?? 0) === 0 || professional) && (
                <div>
                  <p className="mb-3 block text-xs font-semibold uppercase tracking-wider opacity-60">
                    Escolha a data
                  </p>
                  {!days.length ? (
                    <p className="rounded-lg border border-border p-4 text-sm">
                      Nenhum dia de atendimento está disponível no momento.
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Datas anteriores"
                        disabled={pageStart === 0}
                        onClick={() => setPageStart(Math.max(0, pageStart - 7))}
                        className="rounded-md p-1 transition-colors disabled:opacity-30"
                        style={{ color: modalText }}
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
                            className="flex min-w-[4.75rem] flex-col items-center justify-center rounded-xl border px-3 py-2 transition-all active:scale-95"
                            style={
                              {
                                borderColor: appearance.modal_border,
                                backgroundColor:
                                  date === d.date
                                    ? appearance.modal_active_background
                                    : appearance.modal_background,
                                color: date === d.date ? modalActiveText : modalText,
                                "--modal-hover-background": appearance.modal_hover_background,
                                "--modal-hover-text": modalHoverText,
                              } as React.CSSProperties
                            }
                            data-selected={date === d.date}
                          >
                            <span className="block text-sm font-bold">{ddmm(d.date)}</span>
                            <span className="mt-0.5 block text-[11px] capitalize opacity-70">
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
                        className="rounded-md p-1 transition-colors disabled:opacity-30"
                        style={{ color: modalText }}
                      >
                        <ChevronRight className="size-6" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {date && (
                <div>
                  <p className="mb-3 block text-xs font-semibold uppercase tracking-wider opacity-60">
                    Escolha um horário disponível
                  </p>
                  {loadingSlots ? (
                    <p className="flex items-center justify-center gap-2 text-sm">
                      <Loader2 className="size-4 animate-spin" /> Carregando horários...
                    </p>
                  ) : slotsError ? (
                    <p
                      role="alert"
                      className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive"
                    >
                      Não foi possível carregar os horários. Atualize a página e tente novamente.
                    </p>
                  ) : !availability?.slots.length ? (
                    <p className="rounded-lg border border-border p-4 text-sm">
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
                            ""
                          } ${
                            time === s
                              ? ""
                              : "hover:bg-[var(--modal-hover-background)] hover:text-[var(--modal-hover-text)]"
                          }`}
                          style={
                            {
                              borderColor: appearance.modal_border,
                              backgroundColor:
                                time === s
                                  ? appearance.modal_active_background
                                  : appearance.modal_background,
                              color: time === s ? modalActiveText : modalText,
                              "--modal-hover-background": appearance.modal_hover_background,
                              "--modal-hover-text": modalHoverText,
                            } as React.CSSProperties
                          }
                          data-selected={time === s}
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
                    <div
                      className={`mx-auto mt-3 max-w-sm space-y-2 rounded-lg border border-border p-4 text-left text-sm ${
                        ""
                      }`}
                      style={{
                        backgroundColor: appearance.modal_background,
                        color: modalText,
                      }}
                    >
                      <p className="flex items-center gap-2">
                        <Info className="size-4 shrink-0" /> {service.name}
                      </p>
                      <p className="flex items-center gap-2">
                        <User className="size-4 shrink-0" />{" "}
                        {professional?.name ?? "Profissional Agenda"}
                      </p>
                      <p className="flex items-center gap-2">
                        <CalendarDays className="size-4 shrink-0" /> {fullDate(date)}
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock className="size-4 shrink-0" /> {time}
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
                      <>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor="email">E-mail</Label>
                          <Input
                            id="email"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            placeholder="cliente@exemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                          <p className="text-xs">Necessário pra emitir o Pix do sinal.</p>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor="cpf">CPF ou CNPJ</Label>
                          <Input
                            id="cpf"
                            inputMode="numeric"
                            placeholder="000.000.000-00"
                            value={cpfCnpj}
                            onChange={(e) => setCpfCnpj(e.target.value)}
                          />
                          <p className="text-xs">Necessário pra emitir o Pix do sinal.</p>
                        </div>
                      </>
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
                  <p className="text-xs">
                    {needsDocument
                      ? `Sinal de ${formatPrice(selectedDepositCents)} por Pix. O horário só é confirmado após o pagamento.`
                      : "Este serviço não exige sinal. O horário é confirmado ao finalizar."}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
        )}
      </Dialog>

      {activeCharge && (
        <Suspense fallback={<p className="py-4 text-center text-sm">Carregando pagamento...</p>}>
          <PaymentDialog
            chargeId={activeCharge}
            booking={bookings.data?.bookings.find((b) => b.chargeId === activeCharge) ?? null}
            reservedAmountCents={
              reservedAmount?.chargeId === activeCharge ? reservedAmount.amountCents : null
            }
            appearance={appearance}
            onClose={() => {
              setActiveCharge(null);
              void bookings.refetch();
            }}
          />
        </Suspense>
      )}

      {confirmed && (
        <ConfirmedDialog
          booking={confirmed}
          appearance={appearance}
          timezone={catalog?.preferences?.timezone ?? "America/Sao_Paulo"}
          onClose={() => setConfirmed(null)}
        />
      )}

      {/* Aviso de cookies — aparece uma única vez (primeira visita). */}
      <CookieBanner appearance={appearance} />

      {/* Aviso "Saída realizada com sucesso!" ao clicar no botão de saída. */}
      {exitStage !== "hidden" && (
        <div
          className={`fixed inset-0 z-[90] grid place-items-center bg-black/40 backdrop-blur-sm ${
            exitStage === "shown" ? "aa-exit-overlay-in" : "aa-exit-overlay-out"
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="grid size-12 place-items-center rounded-full border border-white/30 bg-white/10">
              <Loader2 className="size-6 animate-spin text-white" />
            </div>
            <p className="text-center text-sm font-semibold text-white drop-shadow">
              Saída realizada com sucesso!
            </p>
          </div>
        </div>
      )}

      {isElegance ? null : (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t"
          style={{
            backgroundColor: pageBackground,
            borderColor: appearance.service_border,
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          <div className="mx-auto flex w-full max-w-2xl items-start justify-around px-2 py-3">
            {(
              [
                { key: "agendar", label: "Agendar", icon: CalendarDays },
                { key: "historico", label: "Histórico", icon: Clock },
                { key: "perfil", label: "Perfil", icon: User },
              ] as const
            ).map((item) => {
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-w-20 flex-col items-center gap-1 text-[13px] transition-opacity ${
                    active ? "font-medium opacity-100" : "opacity-55 hover:opacity-100"
                  }`}
                  style={{ color: pageText }}
                >
                  <item.icon className="size-5" strokeWidth={active ? 2.25 : 2} />
                  <span>{item.label}</span>
                  <span
                    className={`h-1.5 w-10 rounded-full transition-opacity ${
                      active ? "opacity-100" : "opacity-0"
                    }`}
                    style={{ backgroundColor: pageText }}
                  />
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

type Booking = {
  chargeId: string | null;
  chargeStatus: string;
  amountCents: number;
  publicCode: string | null;
  customerName: string | null;
  expiresAt: string | null;
  createdAt: string;
  startsAt: string | null;
  appointmentStatus: string;
  serviceId: string | null;
  professionalId: string | null;
  serviceName: string;
  professionalName: string;
};

function statusInfo(b: Booking) {
  if (b.appointmentStatus === "cancelado")
    return {
      tag: "#Agendamento Cancelado",
      tone: "border-destructive/60",
      label: "Cancelado",
      steps: 3,
    };
  if (b.chargeStatus === "sem_sinal" || b.chargeStatus === "pago")
    return {
      tag: "#Agendamento Confirmado",
      tone: "border-primary/60",
      label: "Confirmado",
      steps: 2,
    };
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
  slug,
  bookings,
  onOpen,
  onRefresh,
  appearance,
  pageText,
  preferences,
  onCancel,
  onReschedule,
  cancelPending,
  reschedulePending,
}: {
  slug: string;
  bookings: Booking[];
  onOpen: (id: string) => void;
  onRefresh: () => void;
  appearance: Panel1Appearance;
  pageText: string;
  preferences?: Panel1Preferences;
  onCancel: (publicCode: string) => void;
  onReschedule: (input: { publicCode: string; date: string; time: string }) => Promise<void>;
  cancelPending: boolean;
  reschedulePending: boolean;
}) {
  const [reschedulingCode, setReschedulingCode] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const rescheduleAvailabilityFn = useServerFn(getAvailability);
  const reschedulingBooking = bookings.find((b) => b.publicCode === reschedulingCode);
  const rescheduleSlots = useQuery({
    queryKey: [
      "reschedule-slots",
      slug,
      reschedulingBooking?.serviceId,
      reschedulingBooking?.professionalId,
      rescheduleDate,
    ],
    enabled: !!reschedulingBooking?.serviceId && !!rescheduleDate,
    queryFn: () =>
      rescheduleAvailabilityFn({
        data: {
          slug,
          serviceId: reschedulingBooking!.serviceId!,
          date: rescheduleDate,
          professionalId: reschedulingBooking?.professionalId ?? null,
        },
      }),
  });
  if (!bookings.length)
    return (
      <div
        className={`rounded-xl border p-8 text-center ${
          ""
        }`}
        style={{
          backgroundColor: appearance.agenda_background,
          color: accessibleTextColor(appearance.agenda_background),
          borderColor: appearance.agenda_border,
        }}
      >
        <History className="mx-auto size-7" />
        <p className="mt-3 font-semibold">Nenhum agendamento por aqui ainda.</p>
        <p className="mt-1 text-sm">Seus agendamentos feitos neste aparelho aparecerão aqui.</p>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="border-b border-border pb-3" style={{ color: pageText }}>
        <p className="text-sm font-semibold">Histórico de agendamentos</p>
        {bookings[0]?.customerName ? <p className="text-sm">{bookings[0].customerName}</p> : null}
      </div>
      {bookings.map((b) => {
        const info = statusInfo(b);
        return (
          <article
            key={b.publicCode ?? b.chargeId ?? b.createdAt}
            className={`rounded-xl border ${info.tone} p-4 ${
              ""
            }`}
            style={{
              backgroundColor: appearance.agenda_background,
              color: accessibleTextColor(appearance.agenda_background),
              borderColor: appearance.agenda_border,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold italic">{info.tag}</p>
              <span className="rounded-full border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">
                {info.label}
              </span>
            </div>
            <div
              className={`mt-3 space-y-2 rounded-lg border p-3 text-sm ${
                ""
              }`}
              style={{
                backgroundColor: appearance.agenda_background,
                color: accessibleTextColor(appearance.agenda_background),
                borderColor: appearance.agenda_border,
              }}
            >
              <p className="flex items-center gap-2">
                <Info className="size-4" /> {b.serviceName}
              </p>
              <p className="flex items-center gap-2">
                <CalendarDays className="size-4" />{" "}
                {b.startsAt
                  ? formatAppointmentDateTime(
                      b.startsAt,
                      preferences?.timezone ?? "America/Sao_Paulo",
                    )
                  : "—"}
              </p>
              <p className="flex items-center gap-2">
                <User className="size-4" /> {b.professionalName}
              </p>
            </div>

            <div className="mt-4 flex items-start justify-center gap-4">
              <Step
                icon={<History className="size-4" />}
                label="Agendamento cadastrado"
                textColor={accessibleTextColor(appearance.agenda_background)}
              />
              {shouldRenderDepositStep(b.chargeStatus) && (
                <Step
                  icon={<DollarSign className="size-4" />}
                  label="Pagamento do sinal"
                  textColor={accessibleTextColor(appearance.agenda_background)}
                />
              )}
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
                  textColor={accessibleTextColor(appearance.agenda_background)}
                />
              )}
            </div>

            {b.chargeStatus === "pendente" && b.chargeId && (
              <Button
                className="mt-4 w-full"
                onClick={() => {
                  if (!b.chargeId) return;
                  onOpen(b.chargeId);
                  onRefresh();
                }}
              >
                Pagar sinal de {formatPrice(b.amountCents)}
              </Button>
            )}
            {b.appointmentStatus === "agendado" && b.publicCode && (
              <div className="mt-3 flex flex-wrap gap-2">
                {preferences?.cancellations_enabled && (
                  <Button
                    variant="outline"
                    disabled={cancelPending || reschedulePending}
                    onClick={() => {
                      setReschedulingCode(null);
                      setRescheduleDate("");
                      setRescheduleTime("");
                      onCancel(b.publicCode!);
                    }}
                  >
                    Cancelar
                  </Button>
                )}
                {preferences?.reschedule_enabled && (
                  <Button
                    variant="outline"
                    disabled={cancelPending || reschedulePending}
                    onClick={() => {
                      setReschedulingCode(reschedulingCode === b.publicCode ? null : b.publicCode);
                      setRescheduleDate("");
                      setRescheduleTime("");
                    }}
                  >
                    Remarcar
                  </Button>
                )}
              </div>
            )}
            {b.publicCode &&
              canRenderRescheduleForm(b.appointmentStatus, reschedulingCode === b.publicCode) && (
                <form
                  className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!rescheduleDate || !rescheduleTime) return;
                    try {
                      await onReschedule({
                        publicCode: b.publicCode!,
                        date: rescheduleDate,
                        time: rescheduleTime,
                      });
                      setReschedulingCode(null);
                      setRescheduleDate("");
                      setRescheduleTime("");
                    } catch {
                      // O erro já é comunicado pelo toast da mutation.
                    }
                  }}
                >
                  <label className="grid gap-1 text-xs">
                    Nova data
                    <Input
                      type="date"
                      required
                      value={rescheduleDate}
                      onChange={(event) => {
                        setRescheduleDate(event.target.value);
                        setRescheduleTime("");
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-xs">
                    Novo horário
                    <select
                      required
                      className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
                      value={rescheduleTime}
                      disabled={!rescheduleDate || rescheduleSlots.isFetching}
                      onChange={(event) => setRescheduleTime(event.target.value)}
                    >
                      <option value="" disabled>
                        {!rescheduleDate
                          ? "Escolha a data"
                          : rescheduleSlots.isFetching
                            ? "Carregando..."
                            : rescheduleSlots.data?.slots.length
                              ? "Selecione"
                              : "Sem horários"}
                      </option>
                      {rescheduleSlots.data?.slots.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="submit"
                    disabled={reschedulePending || !rescheduleDate || !rescheduleTime}
                  >
                    Confirmar
                  </Button>
                </form>
              )}
          </article>
        );
      })}
    </div>
  );
}

function Step({
  icon,
  label,
  textColor,
}: {
  icon: React.ReactNode;
  label: string;
  textColor: string;
}) {
  return (
    <div className="flex w-24 flex-col items-center gap-1 text-center">
      <span
        className="flex size-9 items-center justify-center rounded-full border"
        style={{ borderColor: textColor, color: textColor }}
      >
        {icon}
      </span>
      <span className="text-[10px] leading-tight" style={{ color: textColor }}>
        {label}
      </span>
    </div>
  );
}

function ConfirmedDialog({
  booking,
  appearance,
  timezone,
  onClose,
}: {
  booking: { serviceName: string; startsAt: string };
  appearance: Panel1Appearance;
  timezone: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={`max-w-sm text-center ${
          ""
        }`}
        style={{
          backgroundColor: appearance.modal_background,
          color: accessibleTextColor(appearance.modal_background),
          borderColor: appearance.modal_border,
        }}
      >
        <div className="space-y-4 p-2">
          <span
            className="mx-auto flex size-14 items-center justify-center rounded-full border"
            style={{
              color: accessibleTextColor(appearance.modal_background),
              borderColor: appearance.modal_border,
            }}
          >
            <Check className="size-7" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold">Agendamento confirmado!</h2>
            <p className="mt-1 text-sm">
              Este serviço não exige sinal — seu horário já está garantido.
            </p>
          </div>
          <div
            className={`space-y-2 rounded-lg border p-4 text-left text-sm ${
              ""
            }`}
            style={{
              backgroundColor: appearance.modal_background,
              color: accessibleTextColor(appearance.modal_background),
              borderColor: appearance.modal_border,
            }}
          >
            <p className="flex items-center gap-2">
              <Info className="size-4 shrink-0" /> {booking.serviceName}
            </p>
            <p className="flex items-center gap-2">
              <CalendarDays className="size-4 shrink-0" />{" "}
              {formatAppointmentDateTime(booking.startsAt, timezone)}
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
