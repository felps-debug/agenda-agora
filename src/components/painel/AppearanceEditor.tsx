import { useEffect, useRef, useState } from "react";
import { ImageIcon, Layers, LayoutTemplate, Palette, Tags, Trash2, Type } from "lucide-react";
import { accessibleTextColor, contrastRatio } from "@/lib/contrast";
import {
  PANEL1_APPEARANCE_PRESETS,
  PANEL1_FONTS,
  PANEL1_LOGO_FITS,
  PANEL1_PRESET_DETAILS,
  type Panel1Appearance,
  type Panel1AppearancePreset,
  type Panel1Font,
  type Panel1LogoFit,
} from "@/lib/panel1-config";
import {
  recommendedPalettesForNiche,
  VISUAL_NICHES,
  PANEL_LAYOUT_MODELS,
  type VisualNicheId,
  type VisualLayoutKey,
} from "@/lib/visual-presets";
import { loadOutreachFont, outreachFontFamily } from "@/components/template-editor/fonts";
import type {
  AppearanceSelectionTarget,
  PreviewService,
} from "@/components/public-booking/appearance-preview";
import { ElegancePanel, EleganceServiceList } from "@/components/public-booking/elegance";
import { EleganceBookingDialog } from "@/components/public-booking/elegance-booking";
import {
  VisualEditorShell,
  type VisualPreviewScreen,
} from "@/components/painel/visual-editor/VisualEditorShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const logoFitNames: Record<Panel1LogoFit, string> = {
  quadrado: "Quadrado",
  horizontal: "Horizontal",
  vertical: "Vertical",
};

const APPEARANCE_CONTRAST_PAIRS = [
  { label: "texto do cabeçalho", foreground: "header_text", background: "header_background" },
  { label: "título do negócio", foreground: "header_title", background: "header_background" },
  { label: "texto do card", foreground: "service_text", background: "service_background" },
  { label: "nome do serviço", foreground: "service_name_text", background: "service_background" },
  { label: "valor do serviço", foreground: "service_price_text", background: "service_background" },
  {
    label: "texto do card selecionado",
    foreground: "service_hover_text",
    background: "service_hover_background",
  },
  { label: "texto da janela", foreground: "modal_text", background: "modal_background" },
  { label: "texto da opção", foreground: "modal_hover_text", background: "modal_hover_background" },
  {
    label: "texto da opção ativa",
    foreground: "modal_active_text",
    background: "modal_active_background",
  },
  { label: "texto da agenda", foreground: "agenda_text", background: "agenda_background" },
] as const;

const TARGET_CONTROLS: Record<AppearanceSelectionTarget, { section: string; control: string }> = {
  "page-background": { section: "colors", control: "page-background" },
  "header-background": { section: "colors", control: "header-background" },
  "service-background": { section: "colors", control: "service-background" },
  "logo-cover": { section: "brand", control: "logo-cover" },
  "service-images": { section: "service-images", control: "service-images" },
  "business-title": { section: "text", control: "business-title" },
  "service-name": { section: "text", control: "service-name" },
  "service-price": { section: "text", control: "service-price" },
  "brand-tagline": { section: "text", control: "brand-tagline" },
  "wave-color": { section: "backgrounds", control: "wave-color" },
  "page-text": { section: "text", control: "page-text" },
  buttons: { section: "buttons", control: "buttons" },
};

export function getLowContrastAppearanceLabels(appearance: Panel1Appearance): string[] {
  return APPEARANCE_CONTRAST_PAIRS.filter(
    ({ foreground, background }) =>
      contrastRatio(appearance[foreground], appearance[background]) < 4.5,
  ).map(({ label }) => label);
}

export function hasDivergentAppearanceCustomization(
  appearance: Panel1Appearance,
  preset: Partial<Panel1Appearance>,
): boolean {
  return Object.entries(preset).some(
    ([key, value]) => appearance[key as keyof Panel1Appearance] !== value,
  );
}

type Props = {
  appearance: Panel1Appearance;
  onChange: (appearance: Panel1Appearance) => void;
  onApplyPreset: (preset: Panel1AppearancePreset) => void;
  onSave: () => void;
  saving: boolean;
  dirty?: boolean;
  onUndo?: () => void;
  nicheId: VisualNicheId;
  onNicheIdChange: (nicheId: VisualNicheId) => void;
  layoutKey: VisualLayoutKey;
  onLayoutKeyChange: (layoutKey: VisualLayoutKey) => void;
  businessName: string;
  businessLogoUrl: string | null;
  businessAddress: string | null;
  services: PreviewService[];
  pageBackground: string;
  onPageBackgroundChange: (value: string) => void;
  onLogoFileSelected: (file: File) => void;
  logoUploading: boolean;
  backgroundImageUrl: string | null;
  onBackgroundImageFileSelected: (file: File) => void;
  onClearBackgroundImage: () => void;
  backgroundImageUploading: boolean;
};

export function AppearanceEditor(props: Props) {
  const {
    appearance,
    onChange,
    onApplyPreset,
    onSave,
    saving,
    dirty = true,
    onUndo,
    nicheId,
    onNicheIdChange,
    layoutKey,
    onLayoutKeyChange,
    businessName,
    businessLogoUrl,
    businessAddress,
    services,
    pageBackground,
    onPageBackgroundChange,
    onLogoFileSelected,
    logoUploading,
    backgroundImageUrl,
    onBackgroundImageFileSelected,
    onClearBackgroundImage,
    backgroundImageUploading,
  } = props;
  const [previewScreen, setPreviewScreen] = useState<VisualPreviewScreen>("principal");
  const [pendingPreset, setPendingPreset] = useState<Panel1AppearancePreset | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    model: true,
    niche: true,
    colors: true,
    brand: true,
    "service-images": false,
    text: true,
    buttons: true,
    informacoes: true,
  });
  const [activeControl, setActiveControl] = useState<string | null>(null);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const lowContrastLabels = getLowContrastAppearanceLabels(appearance);

  useEffect(() => {
    loadOutreachFont(appearance.font_family);
  }, [appearance.font_family]);

  useEffect(() => {
    if (layoutKey === "elegance") loadOutreachFont("playfair-display");
  }, [layoutKey]);

  const update = (key: keyof Panel1Appearance, value: string) =>
    onChange({ ...appearance, [key]: value });
  const selectAppearanceTarget = (target: AppearanceSelectionTarget) => {
    const { section, control } = TARGET_CONTROLS[target];
    setOpenSections((current) => ({ ...current, [section]: true }));
    setActiveControl(control);
    if (!window.matchMedia("(min-width: 1024px)").matches) setMobileControlsOpen(true);
    requestAnimationFrame(() => {
      const element = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-appearance-control="${control}"]`),
      ).find((candidate) => candidate.getClientRects().length > 0);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLButtonElement ||
        element instanceof HTMLSelectElement
      )
        element.focus({ preventScroll: true });
    });
  };
  const previewServices = services.length
    ? services
    : [
        {
          id: "preview",
          name: "Corte de cabelo",
          duration_minutes: 40,
          price_cents: 4500,
          effectiveDepositCents: 0,
          show_price: true,
          show_duration: true,
        },
      ];
  const recommendedPaletteIds = recommendedPalettesForNiche(nicheId);
  const paletteIds = [
    ...recommendedPaletteIds,
    ...(Object.keys(PANEL1_APPEARANCE_PRESETS) as Panel1AppearancePreset[]).filter(
      (id) => !recommendedPaletteIds.includes(id),
    ),
  ];

  const elegancePreview = (
    <div
      className="flex flex-1 min-h-full flex-col [&>div]:flex-1"
      style={{
        backgroundColor: pageBackground,
        fontFamily: `'${outreachFontFamily(appearance.font_family)}', sans-serif`,
      }}
    >
      <ElegancePanel
        appearance={appearance}
        brandName={businessName || "Nome do negócio"}
        logoUrl={businessLogoUrl}
        coverUrl={backgroundImageUrl}
        pageBackground={pageBackground}
        activeTab="agendar"
        fullHeight={false}
        minimalist={layoutKey === "classic"}
        onAppearanceTargetSelect={selectAppearanceTarget}
      >
        <EleganceServiceList
          services={previewServices}
          onSelect={() => {}}
          appearance={appearance}
          onAppearanceTargetSelect={selectAppearanceTarget}
        />
      </ElegancePanel>
    </div>
  );
  const informacoesPreview = (
    <EleganceBookingDialog
      asPreview
      minimalist={layoutKey === "classic"}
      service={{ name: businessName || "Barber Richard", price_cents: 4500, duration_minutes: 40, show_price: true, show_duration: true, image_url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Crect width='160' height='160' fill='%23f7d9e4'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='24' fill='%23a4556d'%3EServiço%3C/text%3E%3C/svg%3E" }}
      appearance={appearance}
      pageBackground={appearance.infoPageBackground}
      modalText={accessibleTextColor(appearance.modal_background)}
      modalActiveText={accessibleTextColor(appearance.modal_active_background)}
      onClose={() => setPreviewScreen("principal")}
      professionals={[{ id: "p1", name: "Profissional Agenda", role: "Barbeiro", avatar_url: null }]}
      professional={{ id: "p1", name: "Profissional Agenda", role: "Barbeiro", avatar_url: null }}
      onProfessionalChange={() => {}}
      days={[
        { date: new Date().toISOString().slice(0, 10), weekday: 1 },
        { date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), weekday: 2 },
        { date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), weekday: 3 },
      ]}
      date={new Date().toISOString().slice(0, 10)}
      onDateSelect={() => {}}
      time={null}
      onTimeSelect={() => {}}
      slots={["09:00", "09:30", "10:00", "14:00", "14:30"]}
      slotsLoading={false}
      slotsError={false}
      formName=""
      onNameChange={() => {}}
      formPhone=""
      onPhoneChange={() => {}}
      formEmail=""
      onEmailChange={() => {}}
      formCpfCnpj=""
      onCpfCnpjChange={() => {}}
      needsDocument={false}
      formError={null}
      pending={false}
      onSubmit={() => {}}
      noteText="Seus dados são usados apenas para este agendamento."
    />
  );
  const preview = previewScreen === "informacoes" ? informacoesPreview : elegancePreview;

  return (
    <>
      <VisualEditorShell
        preview={preview}
        previewScreen={previewScreen}
        onPreviewScreenChange={setPreviewScreen}
        dirty={dirty}
        {...(onUndo ? { onUndo } : {})}
        onPublish={onSave}
        publishing={saving}
        mobileControlsOpen={mobileControlsOpen}
        onMobileControlsOpenChange={(open) => {
          setMobileControlsOpen(open);
          if (!open)
            requestAnimationFrame(() => document.getElementById("visual-editor-preview")?.focus());
        }}
        mobilePanelTitle={activeControl ? "Editar aparência selecionada" : "Editar aparência"}
      >
        <div className="space-y-3">
          <EditorSection
            id="model"
            open={!!openSections["model"]}
            onOpenChange={(open) => setOpenSections((current) => ({ ...current, model: open }))}
            icon={<LayoutTemplate className="size-5" />}
            title="Modelo"
            description="Escolha o visual do painel público e alterne quando quiser."
          >
            <div className="grid grid-cols-1 gap-2">
              {PANEL_LAYOUT_MODELS.map((model) => {
                const selected = model.id === "elegance";
                return (
                  <button
                    key={model.id}
                    type="button"
                    aria-pressed={selected}
                    className={`rounded-xl border bg-card p-2 text-left transition-colors hover:border-primary/60 ${
                      selected ? "border-primary ring-2 ring-primary ring-offset-2" : ""
                    }`}
                    onClick={() => onLayoutKeyChange(model.id)}
                  >
                    <span
                      className={`mb-2 flex h-16 items-end justify-center overflow-hidden rounded-md px-3 pt-2 ${
                        model.id === "elegance"
                          ? "bg-[#fff0f3]"
                          : "bg-[var(--c-eef0f2)]"
                      }`}
                      aria-hidden="true"
                    >
                      {model.id === "elegance" ? (
                        <span className="relative block h-9 w-full">
                          <span className="absolute inset-x-2 top-0 h-3 rounded-b-3xl bg-[#e75a8b]/70" />
                          <span className="absolute left-1/2 top-2 size-5 -translate-x-1/2 rounded-full border-2 border-white bg-[#ffd9e4]" />
                          <span className="absolute bottom-0 left-1/2 flex w-full -translate-x-1/2 justify-center gap-[5px]">
                            {[0, 1].map((item) => (
                              <span key={item} className="h-4 w-9 rounded-lg bg-white shadow-sm" />
                            ))}
                          </span>
                          <span className="absolute bottom-0 left-0 right-0 h-1.5 rounded-t-full bg-[#e75a8b]" />
                        </span>
                      ) : (
                        <span className="flex w-full flex-col items-end gap-1 pb-1">
                          <span className="block h-2.5 w-3/4 rounded-full bg-[var(--c-c9ced4)]" />
                          <span className="block h-2.5 w-full rounded-full bg-[var(--c-dfe2e6)]" />
                          <span className="block h-2.5 w-2/3 rounded-full bg-[var(--c-dfe2e6)]" />
                        </span>
                      )}
                    </span>
                    <span className="block text-sm font-semibold">{model.label}</span>
                    <span className="block text-xs text-muted-foreground">{model.description}</span>
                  </button>
                );
              })}
            </div>
          </EditorSection>

          <EditorSection
            id="colors"
            open={!!openSections["colors"]}
            onOpenChange={(open) => setOpenSections((current) => ({ ...current, colors: open }))}
            icon={<Palette className="size-5" />}
            title="Cores"
            description="Comece por uma paleta e ajuste o que quiser."
          >
            <div className="grid grid-cols-2 gap-2">
              {paletteIds.map((preset) => {
                const palette = PANEL1_APPEARANCE_PRESETS[preset];
                const detail = PANEL1_PRESET_DETAILS[preset];
                return (
                  <button
                    key={preset}
                    type="button"
                    className="rounded-xl border bg-card p-2 text-left hover:border-primary/60"
                    onClick={() => setPendingPreset(preset)}
                  >
                    <span className="mb-2 flex overflow-hidden rounded-md">
                      {[
                        detail.pageBackground,
                        palette.header_background,
                        palette.service_background,
                        palette.service_border,
                      ].map((color, index) => (
                        <span
                          key={`${color}-${index}`}
                          className="h-6 flex-1"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </span>
                    <span className="block text-sm font-semibold">{detail.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {detail.description}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <ColorField
                id="page-background"
                active={activeControl === "page-background"}
                label="Fundo da página"
                value={pageBackground}
                onChange={onPageBackgroundChange}
              />
              <ColorField
                label="Cor principal"
                value={appearance.modal_active_background}
                onChange={(value) => update("modal_active_background", value)}
              />
              <ColorField
                id="header-background"
                active={activeControl === "header-background"}
                label="Fundo do cabeçalho"
                value={appearance.header_background}
                onChange={(value) => update("header_background", value)}
              />
              <ColorField
                id="service-background"
                active={activeControl === "service-background"}
                label="Fundo dos serviços"
                value={appearance.service_background}
                onChange={(value) => update("service_background", value)}
              />
            </div>
          </EditorSection>

          <EditorSection
            id="brand"
            open={!!openSections["brand"]}
            onOpenChange={(open) => setOpenSections((current) => ({ ...current, brand: open }))}
            icon={<ImageIcon className="size-5" />}
            title="Logo e capa"
            description="Use sua marca e uma imagem de fundo opcional."
          >
            <div
              data-appearance-control="logo-cover"
              className={`flex flex-wrap gap-2 rounded-xl ${activeControl === "logo-cover" ? "ring-2 ring-primary ring-offset-2" : ""}`}
            >
              <Button
                type="button"
                variant="secondary"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
              >
                <ImageIcon className="size-4" /> {logoUploading ? "Enviando..." : "Trocar logo"}
              </Button>
              {layoutKey !== "classic" ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => backgroundInputRef.current?.click()}
                    disabled={backgroundImageUploading}
                  >
                    <ImageIcon className="size-4" />{" "}
                    {backgroundImageUploading
                      ? "Enviando..."
                      : backgroundImageUrl
                        ? "Trocar capa"
                        : "Adicionar capa"}
                  </Button>
                  {backgroundImageUrl ? (
                    <Button type="button" variant="ghost" onClick={onClearBackgroundImage}>
                      <Trash2 className="size-4" /> Remover capa
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
            <Label className="mt-3 flex items-center justify-between gap-3">
              Formato da logo
              <select
                className="h-10 rounded-lg border bg-background px-2 text-sm"
                value={appearance.logo_fit}
                onChange={(event) =>
                  onChange({ ...appearance, logo_fit: event.target.value as Panel1LogoFit })
                }
              >
                {PANEL1_LOGO_FITS.map((fit) => (
                  <option key={fit} value={fit}>
                    {logoFitNames[fit]}
                  </option>
                ))}
              </select>
            </Label>
          </EditorSection>

          <EditorSection
            id="backgrounds"
            open={!!openSections["backgrounds"]}
            onOpenChange={(open) => setOpenSections((current) => ({ ...current, backgrounds: open }))}
            icon={<Layers className="size-5" />}
            title="Fundos da página"
            description="Personalize a cor base e os detalhes de fundo da página."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <ColorField
                id="wave-color"
                active={activeControl === "wave-color"}
                label="Onda 1"
                value={appearance.wave_color}
                onChange={(value) => update("wave_color", value)}
              />
              <ColorField
                id="wave-color-2"
                active={activeControl === "wave-color-2"}
                label="Onda 2"
                value={appearance.wave_color_2}
                onChange={(value) => update("wave_color_2", value)}
              />
            </div>
            <div className="mt-3 space-y-3">
              <Label className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Fundo Principal</span>
                <select
                  className="h-10 rounded-lg border bg-background px-2 text-sm"
                  value={appearance.page_gradient_enabled ? "gradiente" : "solido"}
                  onChange={(event) =>
                    onChange({ ...appearance, page_gradient_enabled: event.target.value === "gradiente" })
                  }
                >
                  <option value="solido">Cor Sólida</option>
                  <option value="gradiente">Fundo Gradiente</option>
                </select>
              </Label>
              {appearance.page_gradient_enabled ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <ColorField
                    label="Cor Inicial"
                    value={appearance.page_gradient_start}
                    onChange={(value) => update("page_gradient_start", value)}
                  />
                  <ColorField
                    label="Cor Final"
                    value={appearance.page_gradient_end}
                    onChange={(value) => update("page_gradient_end", value)}
                  />
                  <Label className="flex items-center justify-between gap-3 sm:col-span-2">
                    <span className="text-sm font-medium">Direção</span>
                    <select
                      className="h-10 rounded-lg border bg-background px-2 text-sm"
                      value={appearance.page_gradient_direction}
                      onChange={(event) =>
                        update("page_gradient_direction", event.target.value)
                      }
                    >
                      <option value="to bottom">Vertical (cima → baixo)</option>
                      <option value="to right">Horizontal (esq → dir)</option>
                      <option value="to bottom right">Diagonal</option>
                      <option value="radial">Radial</option>
                    </select>
                  </Label>
                </div>
              ) : (
                <ColorField
                  label="Cor de fundo"
                  value={appearance.agenda_background}
                  onChange={(value) => update("agenda_background", value)}
                />
              )}
            </div>
          </EditorSection>

          <EditorSection
            id="text"
            open={!!openSections["text"]}
            onOpenChange={(open) => setOpenSections((current) => ({ ...current, text: open }))}
            icon={<Type className="size-5" />}
            title="Textos e informações"
            description="Ajuste a tipografia e a leitura da página."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <Label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Subtítulo da marca</span>
                <Input
                  data-appearance-control="brand-tagline"
                  value={appearance.brand_tagline}
                  maxLength={80}
                  placeholder="Ex.: Seu olhar ainda mais especial"
                  onChange={(event) => update("brand_tagline", event.target.value)}
                />
              </Label>
            </div>
            <Label className="mt-3 flex items-center justify-between gap-3">
              Fonte
              <select
                className="h-10 rounded-lg border bg-background px-2 text-sm"
                value={appearance.font_family}
                onChange={(event) =>
                  onChange({ ...appearance, font_family: event.target.value as Panel1Font })
                }
              >
                {PANEL1_FONTS.map((font) => (
                  <option key={font} value={font}>
                    {outreachFontFamily(font)}
                  </option>
                ))}
              </select>
            </Label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <ColorField
                id="business-title"
                active={activeControl === "business-title"}
                label="Título do negócio"
                value={appearance.header_title}
                onChange={(value) => update("header_title", value)}
              />
              <ColorField
                id="service-name"
                active={activeControl === "service-name"}
                label="Nome do serviço"
                value={appearance.service_name_text}
                onChange={(value) => update("service_name_text", value)}
              />
              <ColorField
                id="service-price"
                active={activeControl === "service-price"}
                label="Preço e duração"
                value={appearance.service_price_text}
                onChange={(value) => update("service_price_text", value)}
              />
              <ColorField
                id="page-text"
                active={activeControl === "page-text"}
                label="Texto geral"
                value={appearance.page_text}
                onChange={(value) => update("page_text", value)}
              />
            </div>
          </EditorSection>

          <EditorSection
            id="buttons"
            open={!!openSections["buttons"]}
            onOpenChange={(open) => setOpenSections((current) => ({ ...current, buttons: open }))}
            icon={<Type className="size-5" />}
            title="Botões"
            description="Defina o contraste dos estados de seleção e avanço."
          >
            <div
              data-appearance-control="buttons"
              className={`grid gap-2 rounded-xl sm:grid-cols-2 ${activeControl === "buttons" ? "ring-2 ring-primary ring-offset-2" : ""}`}
            >
              <ColorField
                label="Fundo do botão"
                value={appearance.modal_active_background}
                onChange={(value) => update("modal_active_background", value)}
              />
              <ColorField
                label="Texto do botão"
                value={appearance.modal_active_text}
                onChange={(value) => update("modal_active_text", value)}
              />
              <ColorField
                label="Borda do botão"
                value={appearance.modal_border}
                onChange={(value) => update("modal_border", value)}
              />
              <ColorField
                label="Cor ao passar"
                value={appearance.modal_hover_background}
                onChange={(value) => update("modal_hover_background", value)}
              />
            </div>
          </EditorSection>

          <EditorSection
            id="informacoes"
            open={!!openSections["informacoes"]}
            onOpenChange={(open) => setOpenSections((current) => ({ ...current, informacoes: open }))}
            icon={<Type className="size-5" />}
            title="Informações"
            description="Cores da tela de agendamento/detalhes."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <ColorField
                label="Fundo da página (Informações)"
                value={appearance.infoPageBackground}
                onChange={(value) => update("infoPageBackground", value)}
              />
              <ColorField
                label="Contorno do serviço selecionado"
                value={appearance.selectedServiceBorderColor}
                onChange={(value) => update("selectedServiceBorderColor", value)}
              />
              <ColorField
                label="Fundo do botão de voltar"
                value={appearance.backButtonBackgroundColor}
                onChange={(value) => update("backButtonBackgroundColor", value)}
              />
              <ColorField
                label="Ícone do botão de voltar"
                value={appearance.backButtonIconColor}
                onChange={(value) => update("backButtonIconColor", value)}
              />
            </div>
          </EditorSection>

          {lowContrastLabels.length > 0 ? (
            <p
              role="status"
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
            >
              Baixo contraste em {lowContrastLabels.join(", ")}. O texto será ajustado
              automaticamente para manter a leitura.
            </p>
          ) : null}
        </div>
      </VisualEditorShell>

      <input
        ref={logoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-label="Selecionar foto do negócio"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onLogoFileSelected(file);
        }}
      />
      <input
        ref={backgroundInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-label="Selecionar imagem de fundo"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onBackgroundImageFileSelected(file);
        }}
      />

      <Dialog open={!!pendingPreset} onOpenChange={(open) => !open && setPendingPreset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar paleta?</DialogTitle>
            <DialogDescription>
              Fundo, fonte, cabeçalho, cards, agenda e janelas serão substituídos pelo tema{" "}
              {pendingPreset ? PANEL1_PRESET_DETAILS[pendingPreset].name : ""}.
              {pendingPreset &&
              hasDivergentAppearanceCustomization(
                appearance,
                PANEL1_APPEARANCE_PRESETS[pendingPreset],
              )
                ? " As cores ajustadas individualmente serão substituídas."
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setPendingPreset(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (pendingPreset) onApplyPreset(pendingPreset);
                setPendingPreset(null);
              }}
            >
              Aplicar paleta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditorSection({
  id,
  open,
  onOpenChange,
  icon,
  title,
  description,
  children,
}: {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <details
      open={open}
      onToggle={(event) => onOpenChange((event.currentTarget as HTMLDetailsElement).open)}
      className="report-luminous-card report-effect-strong report-metric-card p-4 sm:p-[1.125rem]"
    >
      <summary className="relative z-10 flex cursor-pointer list-none items-start gap-3">
        <span className="report-icon-box">{icon}</span>
        <span>
          <span className="block font-semibold">{title}</span>
          <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
            {description}
          </span>
        </span>
      </summary>
      <div className="relative z-10 mt-4">{children}</div>
    </details>
  );
}

function ColorField({
  id,
  active,
  label,
  value,
  onChange,
}: {
  id?: string;
  active?: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Label
      className={`flex items-center justify-between gap-2 rounded-lg border bg-background px-2 py-1.5 text-xs ${active ? "ring-2 ring-primary ring-offset-2" : ""}`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <ColorPicker value={value} onChange={onChange} />
    </Label>
  );
}
