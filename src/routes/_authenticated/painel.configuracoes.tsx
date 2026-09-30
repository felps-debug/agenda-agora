import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BellRing,
  CalendarClock,
  CalendarDays,
  CalendarX2,
  Clock3,
  Globe2,
  Menu,
  MessageSquareText,
  Settings2,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/lib/business";
import { getPanel1Config, savePanel1Config } from "@/lib/panel1-config.functions";
import {
  resolveBusinessGreeting,
  resolveBusinessTimezone,
  updateBusinessProfile,
} from "@/lib/business.functions";
import {
  DEFAULT_EXTRA_REMINDER_TEMPLATE,
  DEFAULT_PANEL1_PREFERENCES,
  type Panel1Preferences as Preferences,
} from "@/lib/panel1-config";
import { PageHeader, NoBusiness } from "@/components/painel/PageHeader";
import { friendlyError } from "@/lib/error-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const AppearanceSettings = lazy(() =>
  import("@/components/painel/AppearanceSettings").then((module) => ({
    default: module.AppearanceSettings,
  })),
);

export const Route = createFileRoute("/_authenticated/painel/configuracoes")({
  validateSearch: (search: Record<string, unknown>) => ({
    secao:
      search["secao"] === "aparencia"
        ? "aparencia"
        : search["secao"] === "preferencias"
          ? "preferencias"
          : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Configurações — Agenda Agora" },
      { name: "description", content: "Preferências e aparência do painel de agendamento." },
      { property: "og:title", content: "Configurações — Agenda Agora" },
      {
        property: "og:description",
        content: "Configure o funcionamento e a aparência do Painel 1.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

const DEFAULT_PREFERENCES: Preferences = { ...DEFAULT_PANEL1_PREFERENCES };
const DEFAULT_EXTRA_TEMPLATE = DEFAULT_EXTRA_REMINDER_TEMPLATE;

const preferenceItems = [
  ["available", "Horários Disponíveis", Clock3],
  ["listing", "Tempo de Listagem", Timer],
  ["notify", "Avisar Clientes", BellRing],
  ["timezone", "Fuso Horário", Globe2],
  ["dates", "Listar datas", CalendarDays],
  ["cancel", "Cancelamentos", CalendarX2],
  ["reschedule", "Remarcar", CalendarClock],
  ["greeting", "Saudação", MessageSquareText],
] as const;

type PreferenceKey = (typeof preferenceItems)[number][0];

const LISTING_OPTIONS: Array<readonly [number, string]> = [
  [10, "10 Minutos"],
  [15, "15 Minutos"],
  [20, "20 Minutos"],
  [30, "30 Minutos"],
  [40, "40 Minutos"],
  [45, "45 Minutos"],
  [50, "50 Minutos"],
  [60, "1 Hora"],
  [90, "1 Hora e 30 Minutos"],
  [120, "2 Horas"],
  [150, "2 Horas e 30 Minutos"],
  [180, "3 Horas"],
  [210, "3 Horas e 30 Minutos"],
  [240, "4 Horas"],
  [270, "4 Horas e 30 Minutos"],
  [300, "5 Horas"],
  [330, "5 Horas e 30 Minutos"],
  [360, "6 Horas"],
  [390, "6 Horas e 30 Minutos"],
];

const MAIN_REMINDER_OPTIONS: Array<readonly [number, string]> = Array.from(
  { length: 24 },
  (_, index) => {
    const hour = index + 1;
    return [hour, hour === 1 ? "1 Hora" : `${hour} Horas`] as const;
  },
);

const EXTRA_REMINDER_OPTIONS: Array<readonly [number, string]> = [
  [0, "Desabilitado"],
  [10, "10 Minutos"],
  [15, "15 Minutos"],
  [30, "30 Minutos"],
  [40, "40 Minutos"],
  [45, "45 Minutos"],
  [50, "50 Minutos"],
  [60, "1 Hora"],
  [90, "1 Hora e 30 Minutos"],
  [120, "2 Horas"],
  [180, "3 Horas"],
  [240, "4 Horas"],
  [300, "5 Horas"],
  [360, "6 Horas"],
  [420, "7 Horas"],
  [480, "8 Horas"],
  [540, "9 Horas"],
  [600, "10 Horas"],
  [660, "11 Horas"],
  [720, "12 Horas"],
];

const CANCELLATION_OPTIONS: Array<readonly [number, string]> = [
  [0, "0 Minutos"],
  [30, "30 Minutos"],
  [40, "40 Minutos"],
  [45, "45 Minutos"],
  [50, "50 Minutos"],
  [60, "1 Hora"],
  [90, "1 Hora e 30 Minutos"],
  [120, "2 Horas"],
  [180, "3 Horas"],
  [240, "4 Horas"],
  [300, "5 Horas"],
  [360, "6 Horas"],
  [420, "7 Horas"],
  [480, "8 Horas"],
  [540, "9 Horas"],
  [600, "10 Horas"],
  [660, "11 Horas"],
  [720, "12 Horas"],
  [840, "14 Horas"],
  [960, "16 Horas"],
  [1440, "24 Horas"],
];

const RESCHEDULE_OPTIONS = CANCELLATION_OPTIONS;

function ConfiguracoesPage() {
  const { businessId } = useBusiness();
  const { secao } = Route.useSearch();
  const [appearanceSaveStatus, setAppearanceSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const appearanceSavedTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (appearanceSavedTimerRef.current) window.clearTimeout(appearanceSavedTimerRef.current);
    },
    [],
  );

  const markAppearanceSaving = () => {
    if (appearanceSavedTimerRef.current) window.clearTimeout(appearanceSavedTimerRef.current);
    appearanceSavedTimerRef.current = null;
    setAppearanceSaveStatus("saving");
  };

  const markAppearanceSaved = () => {
    setAppearanceSaveStatus("saved");
    if (appearanceSavedTimerRef.current) window.clearTimeout(appearanceSavedTimerRef.current);
    appearanceSavedTimerRef.current = window.setTimeout(() => {
      setAppearanceSaveStatus("idle");
      appearanceSavedTimerRef.current = null;
    }, 2_000);
  };

  if (!businessId) return <NoBusiness />;

  if (secao === "aparencia") {
    return (
      <div className="space-y-6">
        <SettingsSectionSwitcher activeSection="aparencia" />
        <PageHeader title="Configurações" subtitle="Personalize o Painel 1 que o cliente acessa." />
        <p className="-mb-4 min-h-4 text-right text-xs text-muted-foreground" aria-live="polite">
          {appearanceSaveStatus === "saving"
            ? "Salvando..."
            : appearanceSaveStatus === "saved"
              ? "Salvo"
              : null}
        </p>
        <Suspense fallback={null}>
          <AppearanceSettings
            businessId={businessId}
            onSaveStart={markAppearanceSaving}
            onSaveComplete={markAppearanceSaved}
            onSaveError={() => setAppearanceSaveStatus("idle")}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsSectionSwitcher activeSection="preferencias" />
      <PreferencesSettings businessId={businessId} />
    </div>
  );
}

function SettingsSectionSwitcher({
  activeSection,
}: {
  activeSection: "preferencias" | "aparencia";
}) {
  const linkClass = (active: boolean) =>
    `rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    }`;

  return (
    <nav aria-label="Seções de configurações" className="flex gap-2">
      <Link
        to="/painel/configuracoes"
        search={{ secao: undefined }}
        aria-current={activeSection === "preferencias" ? "page" : undefined}
        className={linkClass(activeSection === "preferencias")}
      >
        Preferências
      </Link>
      <Link
        to="/painel/configuracoes"
        search={{ secao: "aparencia" }}
        aria-current={activeSection === "aparencia" ? "page" : undefined}
        className={linkClass(activeSection === "aparencia")}
      >
        Aparência
      </Link>
    </nav>
  );
}

function PreferencesSettings({ businessId }: { businessId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const getConfigFn = useServerFn(getPanel1Config);
  const saveConfigFn = useServerFn(savePanel1Config);
  const updateBusinessFn = useServerFn(updateBusinessProfile);
  const [selected, setSelected] = useState<PreferenceKey>("available");
  const [menuOpen, setMenuOpen] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [ownerName, setOwnerName] = useState("");
  const [loadedBusinessId, setLoadedBusinessId] = useState<string | null>(null);

  const loadPreferences = async () => {
    const [config, businessResult] = await Promise.all([
      getConfigFn({ data: { businessId } }),
      supabase
        .from("businesses")
        .select("reminder_enabled, reminder_hours_before, greeting, timezone")
        .eq("id", businessId)
        .maybeSingle(),
    ]);
    if (businessResult.error) throw businessResult.error;
    return {
      preferences: {
        ...config.preferences,
        greeting: resolveBusinessGreeting(
          businessResult.data?.greeting,
          config.preferences.greeting,
        ),
        timezone: resolveBusinessTimezone(
          businessResult.data?.timezone,
          config.preferences.timezone,
        ),
      },
      reminder_enabled: businessResult.data?.reminder_enabled,
      reminder_hours_before: businessResult.data?.reminder_hours_before,
    };
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["booking-preferences", businessId],
    queryFn: loadPreferences,
  });

  const applyLoadedPreferences = (loaded: NonNullable<typeof data>) => {
    setPrefs({
      ...DEFAULT_PREFERENCES,
      ...loaded.preferences,
      notify_clients: loaded.reminder_enabled ?? loaded.preferences.notify_clients,
      reminder_hours_before:
        loaded.reminder_hours_before ?? loaded.preferences.reminder_hours_before,
    });
    setLoadedBusinessId(businessId);
  };

  const { data: profile } = useQuery({
    queryKey: ["owner-greeting-name", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!data) {
      setLoadedBusinessId(null);
      return;
    }
    applyLoadedPreferences(data);
  }, [data, businessId]);

  useEffect(() => {
    if (profile?.full_name !== undefined) setOwnerName(profile.full_name ?? "");
  }, [profile?.full_name]);

  const save = useMutation({
    mutationFn: async () => {
      const savedParts: string[] = [];
      let currentPart = "preferências do agendamento";
      try {
        const normalizedPrefs: Preferences = {
          ...prefs,
          list_dates_days: Math.max(
            7,
            Math.min(365, Math.floor(Number(prefs.list_dates_days) || 15)),
          ),
          cancellation_notice_minutes: Math.max(
            0,
            Math.min(1440, Math.floor(Number(prefs.cancellation_notice_minutes) || 0)),
          ),
          reschedule_notice_minutes: Math.max(
            0,
            Math.min(1440, Math.floor(Number(prefs.reschedule_notice_minutes) || 0)),
          ),
          extra_reminder_template: prefs.extra_reminder_template || DEFAULT_EXTRA_TEMPLATE,
        };
        // notify_clients/reminder_hours_before não entram no patch: a fonte de
        // verdade é businesses.reminder_enabled/reminder_hours_before (FR-026),
        // atualizada logo abaixo, exatamente como painel.lembretes.tsx já faz.
        const { notify_clients: _notifyClients, ...preferencesPatch } = normalizedPrefs;
        void _notifyClients;
        await saveConfigFn({ data: { businessId, patch: { preferences: preferencesPatch } } });
        savedParts.push("preferências do agendamento");
        currentPart = "lembretes";
        const { data: updatedBusiness, error: reminderError } = await supabase
          .from("businesses")
          .update({
            reminder_enabled: normalizedPrefs.notify_clients,
            reminder_hours_before: normalizedPrefs.reminder_hours_before,
          })
          .eq("id", businessId)
          .select("id")
          .maybeSingle();
        if (reminderError) throw reminderError;
        if (!updatedBusiness) throw new Error("O negócio não foi encontrado para atualizar.");
        savedParts.push("lembretes");
        currentPart = "saudação e fuso horário";
        // A saudação antiga do arquivo é lida acima e migrada para a coluna do negócio
        // no primeiro salvamento; essa é a fonte usada pelos lembretes de WhatsApp.
        await updateBusinessFn({
          data: {
            businessId,
            greeting: normalizedPrefs.greeting,
            timezone: normalizedPrefs.timezone,
          },
        });
        savedParts.push("saudação e fuso horário");
        if (selected === "greeting" && user?.id) {
          currentPart = "nome do perfil";
          const { data: updatedProfile, error: profileError } = await supabase
            .from("profiles")
            .update({ full_name: ownerName.trim() })
            .eq("id", user.id)
            .select("id")
            .maybeSingle();
          if (profileError) throw profileError;
          if (!updatedProfile) throw new Error("O perfil não foi encontrado para atualizar.");
          savedParts.push("nome do perfil");
        }
      } catch {
        const saved = savedParts.length ? `Salvo: ${savedParts.join(", ")}. ` : "";
        throw new Error(
          `${saved}Não foi salvo: ${currentPart}. Os dados do servidor serão recarregados.`,
        );
      }
    },
    onSettled: async (_result, error) => {
      const queryKeys: Array<readonly unknown[]> = [
        ["booking-preferences", businessId],
        ["panel1-config", businessId],
        ["panel1-appearance", businessId],
        ["reminder-config", businessId],
        ...(user?.id ? [["owner-greeting-name", user.id]] : []),
      ];

      await Promise.all(
        queryKeys.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey, refetchType: "none" }),
        ),
      );
      let preferencesRefreshFailed = false;
      let refreshedPreferences: NonNullable<typeof data> | undefined;
      try {
        refreshedPreferences = await queryClient.fetchQuery({
          queryKey: ["booking-preferences", businessId],
          queryFn: loadPreferences,
        });
      } catch {
        preferencesRefreshFailed = true;
      }
      await Promise.all(
        queryKeys
          .slice(1)
          .map((queryKey) => queryClient.refetchQueries({ queryKey, type: "active" })),
      );

      if (!preferencesRefreshFailed && refreshedPreferences) {
        applyLoadedPreferences(refreshedPreferences);
      }

      if (error) {
        const message = friendlyError(error);
        toast.error(
          preferencesRefreshFailed
            ? `${message} Não foi possível confirmar os dados atuais; atualize a página.`
            : message,
        );
      } else if (preferencesRefreshFailed) {
        toast.error("Salvo, mas não foi possível recarregar as configurações. Atualize a página.");
      } else {
        toast.success("Configurações salvas");
      }
    },
  });

  const insertExtraToken = (token: string) => {
    setPrefs((current) => ({
      ...current,
      extra_reminder_template: `${current.extra_reminder_template}${
        current.extra_reminder_template.endsWith(" ") || !current.extra_reminder_template ? "" : " "
      }${token}`,
    }));
  };

  const selectPreference = (key: PreferenceKey) => {
    setSelected(key);
    setMenuOpen(false);
  };

  if (isError) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-2xl border border-[#25282c] bg-[#090a0c] p-6 text-center">
        <p className="text-sm text-[#a0a6af]">Não foi possível carregar as configurações.</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (isLoading || !data || loadedBusinessId !== businessId) {
    return (
      <div
        className="flex min-h-[620px] items-center justify-center rounded-2xl border border-[#25282c] bg-[#090a0c] p-6 text-sm text-[#a0a6af]"
        role="status"
        aria-live="polite"
      >
        Carregando configurações…
      </div>
    );
  }

  return (
    <div className="relative min-h-[620px] overflow-hidden rounded-2xl border border-[#25282c] bg-[#090a0c]">
      {menuOpen && (
        <button
          type="button"
          aria-label="Fechar menu de preferências"
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="grid min-h-[620px] lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside
          className={`preferences-mini-sidebar fixed inset-y-0 left-0 z-[60] w-[min(260px,100vw)] max-w-full overflow-x-hidden overflow-y-auto border-r border-[#18345d] bg-[radial-gradient(ellipse_120%_48%_at_0%_0%,rgba(22,119,255,0.30)_0%,rgba(22,119,255,0.12)_38%,transparent_72%),linear-gradient(180deg,#090d14_0%,#07090d_48%,#050607_100%)] px-3 pb-6 pt-4 shadow-[18px_0_55px_rgba(0,0,0,0.52),4px_0_28px_rgba(22,119,255,0.10)] backdrop-blur-xl transition-[transform,visibility,box-shadow] duration-300 ease-out lg:static lg:z-auto lg:w-auto lg:translate-x-0 lg:visible lg:pointer-events-auto lg:shadow-[inset_-1px_0_0_rgba(93,168,255,0.08)] ${
            menuOpen
              ? "preferences-mini-sidebar-open visible translate-x-0 pointer-events-auto"
              : "invisible -translate-x-full pointer-events-none"
          }`}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-20 -top-24 size-72 rounded-full bg-[#1677ff]/20 blur-[75px] motion-safe:animate-pulse"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 h-64 w-px bg-gradient-to-b from-[#76b2ff] via-[#1677ff]/60 to-transparent shadow-[0_0_16px_rgba(22,119,255,0.75)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-[#5da8ff]/70 via-[#1677ff]/25 to-transparent"
          />
          <div
            aria-hidden="true"
            className="preferences-sidebar-beam pointer-events-none absolute -right-px top-0 h-24 w-px bg-gradient-to-b from-transparent via-[#75b2ff] to-transparent shadow-[0_0_14px_rgba(93,168,255,0.9)]"
          />

          <div className="relative z-10">
            <div className="flex items-center gap-3 px-3 pb-7 pt-1">
              <span className="flex size-9 items-center justify-center rounded-xl border border-[#367bdc]/25 bg-[#1677ff]/10 text-[#69a8ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_22px_rgba(22,119,255,0.14)]">
                <Settings2 className="size-[18px]" strokeWidth={1.8} />
              </span>
              <div>
                <h1 className="!text-[1.35rem] font-medium tracking-[-0.03em] text-[#f5f7fb]">
                  Configurações
                </h1>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.13em] text-[#5d7da9]">
                  Preferências
                </p>
              </div>
            </div>

            <nav aria-label="Preferências do agendamento">
              <p className="flex items-center gap-2 px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#536b8c]">
                <span className="size-1 rounded-full bg-[#1677ff] shadow-[0_0_8px_#1677ff]" />
                Agenda
              </p>
              <div className="space-y-1.5">
                {preferenceItems.slice(0, 5).map(([key, label, Icon]) => (
                  <PreferenceButton
                    key={key}
                    icon={Icon}
                    active={selected === key}
                    onClick={() => selectPreference(key)}
                  >
                    {label}
                  </PreferenceButton>
                ))}
              </div>

              <p className="mt-8 flex items-center gap-2 px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#536b8c]">
                <span className="size-1 rounded-full bg-[#1677ff] shadow-[0_0_8px_#1677ff]" />
                Empresa e clientes
              </p>
              <div className="space-y-1.5">
                {preferenceItems.slice(5).map(([key, label, Icon]) => (
                  <PreferenceButton
                    key={key}
                    icon={Icon}
                    active={selected === key}
                    onClick={() => selectPreference(key)}
                  >
                    {label}
                  </PreferenceButton>
                ))}
              </div>
            </nav>
          </div>
        </aside>

        <section className="min-w-0 p-4 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-2xl">
            <button
              type="button"
              className="mb-5 inline-flex h-10 items-center gap-2 rounded-xl border border-[#367bdc]/35 bg-[#1677ff]/10 px-4 text-sm font-medium text-[#79b1ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_20px_rgba(22,119,255,0.12)] transition-all duration-200 hover:border-[#5da8ff]/55 hover:bg-[#1677ff]/15 hover:text-white hover:shadow-[0_0_24px_rgba(22,119,255,0.18)] lg:hidden"
              aria-label="Abrir menu de preferências"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="size-5" />
              Outras configurações
            </button>

            {selected === "available" && (
              <SettingBlock
                title="Horários Disponíveis"
                description="Escolha quanto tempo antes os horários poderão ser mostrados."
              >
                <NativeSelect
                  value={prefs.minimum_notice_hours}
                  onChange={(value) => setPrefs({ ...prefs, minimum_notice_hours: Number(value) })}
                  options={[
                    [0, "Sem antecedência"],
                    [1, "1 Hora"],
                    [2, "2 Horas"],
                    [4, "4 Horas"],
                    [12, "12 Horas"],
                    [24, "24 Horas"],
                  ]}
                />
              </SettingBlock>
            )}

            {selected === "listing" && (
              <SettingBlock
                title="Tempo de Listagem"
                description="Defina o intervalo usado para organizar a exibição dos horários."
              >
                <NativeSelect
                  value={prefs.listing_time_minutes}
                  onChange={(value) => setPrefs({ ...prefs, listing_time_minutes: Number(value) })}
                  options={LISTING_OPTIONS}
                />
              </SettingBlock>
            )}

            {selected === "notify" && (
              <div>
                <h2 className="text-2xl font-medium tracking-[-0.025em] text-[#f4f5f7]">
                  Avisar Clientes
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[#8b929d]">
                  Escolha quanto tempo de antecedência seu cliente recebe o lembrete.
                </p>
                <div className="mt-12 space-y-3">
                  <label className="block space-y-2">
                    <span className="block text-sm font-semibold leading-5 text-[#f4f5f7]">
                      Enviar lembretes aos clientes
                    </span>
                    <NativeSelect
                      value={prefs.notify_clients ? "ativo" : "desativado"}
                      onChange={(value) =>
                        setPrefs({ ...prefs, notify_clients: value === "ativo" })
                      }
                      options={[
                        ["ativo", "Ativado"],
                        ["desativado", "Desativado"],
                      ]}
                    />
                  </label>
                  <NativeSelect
                    value={prefs.reminder_hours_before}
                    onChange={(value) =>
                      setPrefs({
                        ...prefs,
                        notify_clients: true,
                        reminder_hours_before: Number(value),
                      })
                    }
                    options={MAIN_REMINDER_OPTIONS}
                  />
                  <div className="flex justify-end">
                    <Button onClick={() => save.mutate()} disabled={save.isPending}>
                      {save.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-[#25282c] bg-[#111316] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:p-5">
                  <h3 className="text-2xl font-medium tracking-[-0.025em] text-[#f4f5f7]">
                    Lembrete extra
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#a0a6af]">
                    Habilite e escolha com quanto tempo de antecedência seu cliente recebe o
                    lembrete.
                  </p>
                  <div className="mt-5">
                    <NativeSelect
                      value={prefs.extra_reminder_minutes}
                      onChange={(value) =>
                        setPrefs({ ...prefs, extra_reminder_minutes: Number(value) })
                      }
                      options={EXTRA_REMINDER_OPTIONS}
                    />
                  </div>
                  <Textarea
                    className="mt-2 min-h-[270px] resize-y rounded-xl border-[#2a2d32] bg-[#17191d] px-4 py-4 text-sm leading-6 text-[#f4f5f7]"
                    value={prefs.extra_reminder_template}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        extra_reminder_template: e.target.value.slice(0, 800),
                      })
                    }
                    maxLength={800}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      ["Saudação", "{Saudacao}"],
                      ["Horário", "{Horario}"],
                      ["Cliente", "{Cliente}"],
                      ["Data", "{Data}"],
                    ].map(([label, token]) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => insertExtraToken(token!)}
                        className="rounded-lg border border-[#2a2d32] bg-[#202226] px-4 py-2 text-xs font-medium text-[#b8bec7] transition-colors hover:border-[#1677ff]/40 hover:text-white"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button onClick={() => save.mutate()} disabled={save.isPending}>
                      {save.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {selected === "timezone" && (
              <SettingBlock
                title="Fuso Horário"
                description="Defina o fuso usado como referência para a agenda."
              >
                <NativeSelect
                  value={prefs.timezone}
                  onChange={(timezone) => setPrefs({ ...prefs, timezone })}
                  options={[
                    ["America/Sao_Paulo", "Brasília / São Paulo"],
                    ["America/Manaus", "Manaus"],
                    ["America/Recife", "Recife"],
                    ["America/Cuiaba", "Cuiabá"],
                  ]}
                />
              </SettingBlock>
            )}

            {selected === "dates" && (
              <SettingBlock
                title="Listar Datas"
                description="Informe a quantidade de datas disponíveis para agendamento. (mínimo 7)"
              >
                <Input
                  type="number"
                  min={7}
                  max={365}
                  step={1}
                  value={prefs.list_dates_days}
                  onChange={(e) => setPrefs({ ...prefs, list_dates_days: Number(e.target.value) })}
                  onBlur={() =>
                    setPrefs((current) => ({
                      ...current,
                      list_dates_days: Math.max(
                        7,
                        Math.min(365, Math.floor(Number(current.list_dates_days) || 15)),
                      ),
                    }))
                  }
                  className="h-12 rounded-xl border-[#2a2d32] bg-[#17191d] px-4 text-sm text-[#f4f5f7]"
                />
              </SettingBlock>
            )}

            {selected === "cancel" && (
              <div>
                <h2 className="text-2xl font-medium tracking-[-0.025em] text-[#f4f5f7]">
                  Cancelamento
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[#8b929d]">
                  Controle se o cliente pode cancelar e a antecedência necessária.
                </p>
                <div className="mt-12 grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="block text-sm font-semibold leading-5 text-[#f4f5f7]">
                      Permitir cancelamento dos clientes
                    </span>
                    <NativeSelect
                      value={prefs.cancellations_enabled ? "permitido" : "bloqueado"}
                      onChange={(value) =>
                        setPrefs({ ...prefs, cancellations_enabled: value === "permitido" })
                      }
                      options={[
                        ["permitido", "Permitido"],
                        ["bloqueado", "Não permitido"],
                      ]}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="block text-sm font-semibold leading-5 text-[#f4f5f7]">
                      Tempo antecedente para cancelamento
                    </span>
                    <NativeSelect
                      value={prefs.cancellation_notice_minutes}
                      onChange={(value) =>
                        setPrefs({ ...prefs, cancellation_notice_minutes: Number(value) })
                      }
                      options={CANCELLATION_OPTIONS}
                    />
                  </label>
                </div>
              </div>
            )}

            {selected === "reschedule" && (
              <div>
                <h2 className="text-2xl font-medium tracking-[-0.025em] text-[#f4f5f7]">
                  Remarcação
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[#8b929d]">
                  Permissão para o cliente remarcar o agendamento.
                </p>
                <div className="mt-12 grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="block text-sm font-semibold leading-5 text-[#f4f5f7]">
                      Permitir remarcação dos clientes
                    </span>
                    <NativeSelect
                      value={prefs.reschedule_enabled ? "permitido" : "bloqueado"}
                      onChange={(value) =>
                        setPrefs({ ...prefs, reschedule_enabled: value === "permitido" })
                      }
                      options={[
                        ["bloqueado", "Não Permitido"],
                        ["permitido", "Permitido"],
                      ]}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="block text-sm font-semibold leading-5 text-[#f4f5f7]">
                      Tempo antecedente para remarcar
                    </span>
                    <NativeSelect
                      value={prefs.reschedule_notice_minutes}
                      onChange={(value) =>
                        setPrefs({ ...prefs, reschedule_notice_minutes: Number(value) })
                      }
                      options={RESCHEDULE_OPTIONS}
                    />
                  </label>
                </div>
              </div>
            )}

            {selected === "greeting" && (
              <SettingBlock
                title="Saudação"
                description="Edite a saudação pública do Painel 1 e o nome exibido no Painel 2."
              >
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Saudação do Painel 1</label>
                    <Input
                      value={prefs.greeting}
                      onChange={(e) =>
                        setPrefs({ ...prefs, greeting: e.target.value.slice(0, 80) })
                      }
                      maxLength={80}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome da saudação do Painel 2</label>
                    <Input
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value.slice(0, 40))}
                      maxLength={40}
                      placeholder="Ex.: Guilherme"
                    />
                  </div>
                </div>
              </SettingBlock>
            )}

            {selected !== "notify" && (
              <div className="mt-7 flex justify-end">
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function PreferenceButton({
  icon: Icon,
  active,
  onClick,
  children,
}: {
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`preferences-menu-button group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-left text-sm transition-all duration-200 ease-out ${active ? "preferences-menu-button-active translate-x-1 border-[#2f83ff]/30 bg-[linear-gradient(90deg,rgba(22,119,255,0.18),rgba(22,119,255,0.07))] font-semibold text-white shadow-[inset_0_1px_0_rgba(112,168,255,0.08),0_8px_24px_rgba(0,0,0,0.16),0_0_22px_rgba(22,119,255,0.07)]" : "border-transparent text-[#939ba7] hover:translate-x-1 hover:border-[#1677ff]/15 hover:bg-[#1677ff]/[0.065] hover:text-[#edf4ff]"}`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="preferences-menu-click-flash pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-[#5da8ff]/20 to-transparent"
        />
      )}
      {active && (
        <span className="absolute inset-y-2 left-0 z-10 w-[3px] rounded-r-full bg-[#3b8cff] shadow-[0_0_12px_rgba(59,140,255,0.9)]" />
      )}
      <Icon
        className={`relative z-10 size-[17px] shrink-0 transition-all duration-200 ${active ? "text-[#69a8ff] drop-shadow-[0_0_5px_rgba(22,119,255,0.65)]" : "text-[#596474] group-hover:text-[#5da8ff]"}`}
        strokeWidth={1.8}
      />
      <span className="relative z-10 min-w-0 truncate">{children}</span>
      {active && (
        <span className="relative z-10 ml-auto size-1.5 shrink-0 rounded-full bg-[#5da8ff] shadow-[0_0_9px_rgba(93,168,255,0.95)] motion-safe:animate-pulse" />
      )}
    </button>
  );
}

function SettingBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-2xl font-medium tracking-[-0.025em] text-[#f4f5f7]">{title}</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[#8b929d]">{description}</p>
      <div className="mt-12">{children}</div>
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  options,
}: {
  value: string | number;
  onChange: (value: string) => void;
  options: Array<readonly [string | number, string]>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full rounded-xl border border-[#2a2d32] bg-[#17191d] px-4 text-sm text-[#f4f5f7] outline-none focus:border-[#1677ff]/60"
    >
      {options.map(([optionValue, label]) => (
        <option key={String(optionValue)} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}
