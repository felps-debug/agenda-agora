import { useEffect, useRef, useState } from "react";
import { ImageIcon, Trash2 } from "lucide-react";
import { contrastRatio } from "@/lib/contrast";
import {
  PANEL1_APPEARANCE_PRESETS,
  PANEL1_FONTS,
  PANEL1_LOGO_FITS,
  type Panel1Appearance,
  type Panel1AppearancePreset,
  type Panel1Font,
  type Panel1LogoFit,
} from "@/lib/panel1-config";
import { loadOutreachFont, outreachFontFamily } from "@/components/template-editor/fonts";
import {
  BusinessHeader,
  ServiceSection,
  type PreviewService,
} from "@/components/public-booking/appearance-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const presetNames: Record<Panel1AppearancePreset, string> = {
  noturno: "Noturno",
  classico: "Clássico",
  claro: "Claro",
  verde: "Verde",
};

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
] as const;

export function getLowContrastAppearanceLabels(appearance: Panel1Appearance): string[] {
  return APPEARANCE_CONTRAST_PAIRS.filter(
    ({ foreground, background }) =>
      contrastRatio(appearance[foreground], appearance[background]) < 4.5,
  ).map(({ label }) => label);
}

/** US3 cenário 3: já existe cor customizada em campo que o preset também define? */
export function hasDivergentAppearanceCustomization(
  appearance: Panel1Appearance,
  preset: Partial<Panel1Appearance>,
): boolean {
  return Object.entries(preset).some(
    ([key, value]) => appearance[key as keyof Panel1Appearance] !== value,
  );
}

type Region = "page" | "header" | "service" | null;

export function AppearanceEditor({
  appearance,
  onChange,
  onApplyPreset,
  onSave,
  saving,
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
}: {
  appearance: Panel1Appearance;
  onChange: (appearance: Panel1Appearance) => void;
  onApplyPreset: (preset: Panel1AppearancePreset) => void;
  onSave: () => void;
  saving: boolean;
  businessName: string;
  businessLogoUrl: string | null;
  businessAddress: string | null;
  services: PreviewService[];
  pageBackground: string;
  onPageBackgroundChange: (value: string) => void;
  /** Troca direta da foto/logo, sem passar pelo popover de cor do cabeçalho. */
  onLogoFileSelected: (file: File) => void;
  logoUploading: boolean;
  backgroundImageUrl: string | null;
  onBackgroundImageFileSelected: (file: File) => void;
  onClearBackgroundImage: () => void;
  backgroundImageUploading: boolean;
}) {
  const [region, setRegion] = useState<Region>(null);
  const [pendingPreset, setPendingPreset] = useState<Panel1AppearancePreset | null>(null);
  const lowContrastLabels = getLowContrastAppearanceLabels(appearance);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    loadOutreachFont(appearance.font_family);
  }, [appearance.font_family]);
  const update = (key: keyof Panel1Appearance, value: string) =>
    onChange({ ...appearance, [key]: value });

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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <section className="space-y-3" aria-labelledby="appearance-presets">
        <div>
          <h2 id="appearance-presets" className="font-semibold">
            Presets de cores
          </h2>
          <p className="text-sm text-muted-foreground">
            Escolha uma combinação e confirme para aplicar a todos os serviços.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PANEL1_APPEARANCE_PRESETS) as Panel1AppearancePreset[]).map((preset) => (
            <Button
              key={preset}
              type="button"
              variant="secondary"
              onClick={() => setPendingPreset(preset)}
            >
              {presetNames[preset]}
            </Button>
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="appearance-preview">
        <div>
          <h2 id="appearance-preview" className="font-semibold">
            Pré-visualização
          </h2>
          <p className="text-sm text-muted-foreground">
            Esta é a mesma tela que o cliente vê. Clique em qualquer parte — fundo, barra, card —
            para editar a cor.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border shadow-sm">
          <Popover
            open={region === "page"}
            onOpenChange={(open) => setRegion(open ? "page" : null)}
          >
            <PopoverTrigger asChild>
              <div
                role="button"
                tabIndex={0}
                className="cursor-pointer px-4 pb-10 pt-3 focus-visible:outline-none"
                style={{
                  backgroundColor: pageBackground,
                  fontFamily: `'${outreachFontFamily(appearance.font_family)}', sans-serif`,
                  ...(backgroundImageUrl
                    ? {
                        backgroundImage: `url(${backgroundImageUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : {}),
                }}
                aria-label="Editar fundo da página"
              >
                <div className="mx-auto max-w-md space-y-4">
                  <div onClick={(event) => event.stopPropagation()}>
                    <Popover
                      open={region === "header"}
                      onOpenChange={(open) => setRegion(open ? "header" : null)}
                    >
                      <PopoverTrigger asChild>
                        <div
                          role="button"
                          tabIndex={0}
                          className="-mx-4 cursor-pointer overflow-hidden focus-visible:outline-none"
                          aria-label="Editar barra superior e título"
                        >
                          <div
                            className="px-4 py-2 text-center text-xs font-bold uppercase tracking-[0.18em]"
                            style={{
                              backgroundColor: appearance.header_background,
                              color: appearance.header_text,
                            }}
                          >
                            Agenda Agora · Contato
                          </div>
                          <BusinessHeader
                            name={businessName || "Nome do negócio"}
                            logoUrl={businessLogoUrl}
                            address={businessAddress}
                            appearance={appearance}
                            onLogoClick={() => logoInputRef.current?.click()}
                          />
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="grid gap-3">
                        <h3 className="font-semibold">Barra superior e título</h3>
                        <p className="text-xs text-muted-foreground">
                          Clique direto na foto na prévia pra trocá-la.
                        </p>
                        <Label className="flex items-center justify-between gap-4">
                          Tamanho da foto
                          <select
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                            value={appearance.logo_fit}
                            onChange={(event) =>
                              onChange({
                                ...appearance,
                                logo_fit: event.target.value as Panel1LogoFit,
                              })
                            }
                          >
                            {PANEL1_LOGO_FITS.map((fit) => (
                              <option key={fit} value={fit}>
                                {logoFitNames[fit]}
                              </option>
                            ))}
                          </select>
                        </Label>
                        {logoUploading && (
                          <p className="text-xs text-muted-foreground">Enviando foto...</p>
                        )}
                        <ColorField
                          label="Fundo do cabeçalho"
                          value={appearance.header_background}
                          onChange={(value) => update("header_background", value)}
                        />
                        <ColorField
                          label="Texto do cabeçalho"
                          value={appearance.header_text}
                          onChange={(value) => update("header_text", value)}
                        />
                        <ColorField
                          label="Título do negócio"
                          value={appearance.header_title}
                          onChange={(value) => update("header_title", value)}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div onClick={(event) => event.stopPropagation()}>
                    <Popover
                      open={region === "service"}
                      onOpenChange={(open) => setRegion(open ? "service" : null)}
                    >
                      <PopoverTrigger asChild>
                        <div
                          role="button"
                          tabIndex={0}
                          className="cursor-pointer rounded-xl focus-visible:outline-none"
                          aria-label="Editar cores do card de serviço"
                        >
                          <ServiceSection
                            services={previewServices}
                            onSelect={() => {}}
                            appearance={appearance}
                            pageText={appearance.page_text}
                          />
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="grid gap-3">
                        <h3 className="font-semibold">Card de serviço</h3>
                        <ColorField
                          label="Nome do serviço"
                          value={appearance.service_name_text}
                          onChange={(value) => update("service_name_text", value)}
                        />
                        <ColorField
                          label="Valor do serviço"
                          value={appearance.service_price_text}
                          onChange={(value) => update("service_price_text", value)}
                        />
                        <ColorField
                          label="Borda do card"
                          value={appearance.service_border}
                          onChange={(value) => update("service_border", value)}
                        />
                        <ColorField
                          label="Fundo do card"
                          value={appearance.service_background}
                          onChange={(value) => update("service_background", value)}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="grid gap-3">
              <h3 className="font-semibold">Fundo da página</h3>
              <ColorField
                label="Cor de fundo"
                value={pageBackground}
                onChange={onPageBackgroundChange}
              />
              <ColorField
                label="Texto sobre o fundo"
                value={appearance.page_text}
                onChange={(value) => update("page_text", value)}
              />
              <div className="space-y-2 border-t border-border pt-3">
                <Label className="block">Imagem de fundo (opcional)</Label>
                {backgroundImageUploading ? (
                  <p className="text-xs text-muted-foreground">Enviando imagem...</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => backgroundInputRef.current?.click()}
                    >
                      <ImageIcon className="size-4" />
                      {backgroundImageUrl ? "Trocar imagem" : "Adicionar imagem"}
                    </Button>
                    {backgroundImageUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClearBackgroundImage}
                      >
                        <Trash2 className="size-4" />
                        Usar só a cor
                      </Button>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Quando tem imagem, ela cobre o fundo inteiro; a cor de fundo continua valendo se
                  você remover a imagem.
                </p>
              </div>
              <Label className="flex items-center justify-between gap-4 border-t border-border pt-3">
                Fonte dos textos
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
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
            </PopoverContent>
          </Popover>
        </div>
      </section>

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

      {lowContrastLabels.length > 0 && (
        <p
          role="status"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
        >
          Baixo contraste em {lowContrastLabels.join(", ")}. O texto será ajustado automaticamente
          para manter a leitura.
        </p>
      )}
      <Button type="button" disabled={saving} onClick={onSave}>
        {saving ? "Salvando..." : "Salvar aparência"}
      </Button>

      <Dialog open={!!pendingPreset} onOpenChange={(open) => !open && setPendingPreset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar preset a todos os serviços?</DialogTitle>
            <DialogDescription>
              As cores do cabeçalho e de todos os cards serão substituídas pelo preset{" "}
              {pendingPreset ? presetNames[pendingPreset] : ""}.
              {pendingPreset &&
                hasDivergentAppearanceCustomization(
                  appearance,
                  PANEL1_APPEARANCE_PRESETS[pendingPreset],
                ) && (
                  <>
                    {" "}
                    Você já personalizou algumas dessas cores individualmente; elas serão
                    substituídas pelo preset.
                  </>
                )}
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
              Aplicar a todos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Label className="flex items-center justify-between gap-4">
      {label}
      <Input
        aria-label={label}
        className="w-16"
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Label>
  );
}
