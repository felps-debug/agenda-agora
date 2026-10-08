import { useEffect, useRef, useState } from "react";
import { ImageIcon, Palette, Tags, Trash2, Type } from "lucide-react";
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
  PANEL_LAYOUT_MODELS,
  recommendedPalettesForNiche,
  VISUAL_NICHES,
  type VisualLayoutKey,
  type VisualNicheId,
} from "@/lib/visual-presets";
import { loadOutreachFont, outreachFontFamily } from "@/components/template-editor/fonts";
import {
  type AppearanceSelectionTarget,
  type PreviewService,
} from "@/components/public-booking/appearance-preview";
import {
  liquidGlassPageBase,
  liquidGlassReadableAppearance,
} from "@/components/public-booking/liquid-glass";
import {
  RefHeader,
  RefLogo,
  RefMain,
  RefNav,
  RefServices,
  refPageTheme,
} from "@/components/public-booking/liquid-glass-reference";
import {
  VisualEditorShell,
  type VisualPreviewMode,
} from "@/components/painel/visual-editor/VisualEditorShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  layoutKey: VisualLayoutKey;
  onLayoutKeyChange: (layoutKey: VisualLayoutKey) => void;
  nicheId: VisualNicheId;
  onNicheIdChange: (nicheId: VisualNicheId) => void;
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
    layoutKey,
    onLayoutKeyChange,
    nicheId,
    onNicheIdChange,
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
  const [previewMode, setPreviewMode] = useState<VisualPreviewMode>("mobile");
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
  });
  const [activeControl, setActiveControl] = useState<string | null>(null);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const lowContrastLabels = getLowContrastAppearanceLabels(appearance);

  useEffect(() => {
    loadOutreachFont(appearance.font_family);
  }, [appearance.font_family]);

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

  // A prévia usa os mesmos componentes da página pública, então mostra exatamente o que o cliente vê.
  const glassLayout = layoutKey === "liquid_glass";
  const previewAppearance = glassLayout
    ? liquidGlassReadableAppearance(appearance, liquidGlassPageBase(pageBackground, appearance))
    : appearance;
  const previewTextBase = glassLayout
    ? liquidGlassPageBase(pageBackground, appearance)
    : pageBackground;
  const previewText = (() => {
    try {
      if (contrastRatio(previewAppearance.page_text, previewTextBase) >= 4.5)
        return previewAppearance.page_text;
    } catch {
      /* cor inválida: usa o automático */
    }
    return accessibleTextColor(previewTextBase);
  })();
  const previewTheme = refPageTheme({
    layout: layoutKey,
    appearance: previewAppearance,
    pageBackground,
    pageBackgroundImage: backgroundImageUrl,
    fontFamily: outreachFontFamily(appearance.font_family),
    text: previewText,
    extraClass: "lg-preview",
  });

  const preview = (
    <div
      className={previewTheme.className}
      style={previewTheme.style}
      onClick={() => selectAppearanceTarget("page-background")}
    >
      <RefHeader phone={null} color={previewAppearance.header_text} onTarget={selectAppearanceTarget} />
      <RefMain
        logo={
          <RefLogo
            name={businessName || "Nome do negócio"}
            logoUrl={businessLogoUrl}
            onTarget={selectAppearanceTarget}
          />
        }
      >
        <RefServices
          services={previewServices}
          selectedId={null}
          onToggle={() => {}}
          onTarget={selectAppearanceTarget}
        />
      </RefMain>
      <RefNav tab="agendar" onChange={() => {}} onTarget={selectAppearanceTarget} />
    </div>
  );

  return (
    <>
      <VisualEditorShell
        preview={preview}
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
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
            icon={<Palette className="size-5" />}
            title="Modelo"
            description="Escolha a base visual da página."
          >
            <div className="grid grid-cols-2 gap-3">
              {PANEL_LAYOUT_MODELS.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  aria-pressed={layoutKey === model.id}
                  onClick={() => onLayoutKeyChange(model.id)}
                  className={
                    layoutKey === model.id
                      ? "rounded-xl border-2 border-primary bg-primary/5 p-3 text-left"
                      : "rounded-xl border bg-card p-3 text-left hover:border-primary/50"
                  }
                >
                  <span className="block font-semibold">{model.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {model.description}
                  </span>
                </button>
              ))}
            </div>
          </EditorSection>

          <EditorSection
            id="niche"
            open={!!openSections["niche"]}
            onOpenChange={(open) => setOpenSections((current) => ({ ...current, niche: open }))}
            icon={<Tags className="size-5" />}
            title="Nicho"
            description="Use recomendações que combinam com seu negócio."
          >
            <select
              aria-label="Nicho do negócio"
              value={nicheId}
              onChange={(event) => onNicheIdChange(event.target.value as VisualNicheId)}
              className="h-11 w-full rounded-lg border bg-background px-3 text-sm"
            >
              {VISUAL_NICHES.map((niche) => (
                <option key={niche.id} value={niche.id}>
                  {niche.label}
                </option>
              ))}
            </select>
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
            id="service-images"
            open={!!openSections["service-images"]}
            onOpenChange={(open) =>
              setOpenSections((current) => ({ ...current, "service-images": open }))
            }
            icon={<ImageIcon className="size-5" />}
            title="Imagens dos serviços"
            description="As imagens mostradas nos cards são cadastradas em Serviços."
          >
            <div
              data-appearance-control="service-images"
              className={`rounded-xl border border-dashed p-3 text-sm text-muted-foreground ${activeControl === "service-images" ? "ring-2 ring-primary ring-offset-2" : ""}`}
            >
              Para trocar arquivos ou definir a foto de cada serviço, use o módulo Serviços. Aqui a
              prévia mostra exatamente como elas aparecem para o cliente.
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
            <Label className="flex items-center justify-between gap-3">
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
      className="rounded-2xl border bg-card p-4"
    >
      <summary className="flex cursor-pointer list-none items-start gap-3">
        <span className="mt-0.5 text-primary">{icon}</span>
        <span>
          <span className="block font-semibold">{title}</span>
          <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
            {description}
          </span>
        </span>
      </summary>
      <div className="mt-4">{children}</div>
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
      <Input
        data-appearance-control={id}
        aria-label={label}
        className="size-9 shrink-0 border-0 bg-transparent p-0"
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Label>
  );
}
