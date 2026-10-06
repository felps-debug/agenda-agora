import { useRef, useState } from "react";
import { ImageIcon, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import type { OutreachDesign, OutreachDesignLayer } from "@/lib/outreach-design";
import { OUTREACH_FONTS, OUTREACH_ICON_KEYS } from "@/lib/outreach-design";
import { outreachFontFamily } from "./fonts";
import { TemplateIconGlyph } from "./icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TemplateCanvas } from "./TemplateCanvas";

const iconLabels: Record<(typeof OUTREACH_ICON_KEYS)[number], string> = {
  scissors: "Tesoura",
  calendar: "Calendário",
  clock: "Relógio",
  star: "Estrela",
  sparkles: "Brilhos",
  "map-pin": "Localização",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  check: "Confirmado",
  heart: "Favorito",
  gift: "Promoção",
  crown: "VIP",
  bell: "Lembrete",
  tag: "Desconto",
  "thumbs-up": "Aprovado",
  users: "Equipe",
  smile: "Satisfação",
  camera: "Antes e depois",
  flame: "Em alta",
  percent: "Percentual",
};

function IconPicker({
  value,
  onChange,
}: {
  value: (typeof OUTREACH_ICON_KEYS)[number];
  onChange: (key: (typeof OUTREACH_ICON_KEYS)[number]) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = OUTREACH_ICON_KEYS.filter((key) =>
    iconLabels[key].toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar ícone..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Buscar ícone"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-md px-3 py-2 text-sm text-muted-foreground">
          Nenhum ícone encontrado.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {filtered.map((key) => (
            <button
              key={key}
              type="button"
              aria-label={iconLabels[key]}
              aria-pressed={value === key}
              onClick={() => onChange(key)}
              className={`flex flex-col items-center gap-1 rounded-md border p-2 text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                value === key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              <TemplateIconGlyph iconKey={key} className="size-5" />
              <span className="truncate">{iconLabels[key]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function EditorPanel({
  design,
  selectedLayerIndex,
  onChange,
  onSelect,
}: {
  design: OutreachDesign;
  selectedLayerIndex: number | null;
  onChange: (design: OutreachDesign) => void;
  onSelect: (index: number | null) => void;
}) {
  const selected = selectedLayerIndex === null ? undefined : design.layers[selectedLayerIndex];
  const [bgImageError, setBgImageError] = useState<string | null>(null);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const patchLayer = (patch: Partial<OutreachDesignLayer>) => {
    if (!selected || selectedLayerIndex === null) return;
    onChange({
      ...design,
      layers: design.layers.map((layer, index) =>
        index === selectedLayerIndex ? ({ ...layer, ...patch } as OutreachDesignLayer) : layer,
      ),
    });
  };

  const addLayer = (type: "text" | "icon" | "shape") => {
    const id = crypto.randomUUID();
    const base = { id, x: 80, y: 80, width: 400, height: 100, rotation: 0, opacity: 1 };
    const layer: OutreachDesignLayer =
      type === "text"
        ? {
            ...base,
            type,
            text: "Novo texto",
            color: "#ffffff",
            font: "inter",
            fontSize: 48,
            fontWeight: "bold",
            align: "left",
          }
        : type === "icon"
          ? { ...base, type, iconKey: "scissors", color: "#ffffff" }
          : { ...base, type, shape: "rectangle", fill: "#ffffff", strokeWidth: 0, radius: 12 };
    onChange({ ...design, layers: [...design.layers, layer] });
    onSelect(design.layers.length);
    setMobileControlsOpen(true);
  };
  const selectLayer = (index: number | null) => {
    onSelect(index);
  };

  return (
    <div className="grid min-h-[70vh] gap-5 pb-20 lg:grid-cols-[320px_minmax(0,1fr)] lg:pb-0">
      <div
        id="art-editor-preview"
        tabIndex={-1}
        className="flex min-h-[calc(100dvh-12rem)] flex-col items-center justify-center gap-2 overflow-auto rounded-2xl border border-border bg-muted/40 p-3 shadow-inner outline-none sm:p-5 lg:order-2 lg:sticky lg:top-[5.75rem] lg:min-h-[520px] lg:self-start lg:rounded-3xl"
      >
        <TemplateCanvas
          design={design}
          className="max-h-[68vh] max-w-full shadow-xl"
          style={{ aspectRatio: `${design.width} / ${design.height}` }}
          selectedLayerIndex={selectedLayerIndex}
          onSelect={selectLayer}
          onChange={onChange}
        />
        <p className="text-center text-xs text-muted-foreground">
          Toque para selecionar. Arraste para mover diretamente na arte e puxe as alças para
          redimensionar. Com uma camada selecionada: setas movem 1px, Shift+setas redimensiona.
        </p>
      </div>
      {mobileControlsOpen ? (
        <button
          type="button"
          aria-label="Fechar edição"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => {
            setMobileControlsOpen(false);
            requestAnimationFrame(() => document.getElementById("art-editor-preview")?.focus());
          }}
        />
      ) : null}
      <aside
        className={`${mobileControlsOpen ? "fixed inset-x-0 bottom-0 z-50 max-h-[82dvh] overflow-y-auto rounded-t-2xl border border-border bg-card p-4 shadow-2xl" : "hidden"} space-y-5 lg:static lg:order-1 lg:block lg:max-h-none lg:overflow-visible lg:rounded-2xl lg:shadow-none`}
      >
        <div className="flex items-center justify-between lg:hidden">
          <h2 className="font-semibold">Editar arte</h2>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Fechar edição"
            onClick={() => {
              setMobileControlsOpen(false);
              requestAnimationFrame(() => document.getElementById("art-editor-preview")?.focus());
            }}
          >
            <X className="size-4" />
          </Button>
        </div>
        <div>
          <h2 className="font-semibold">Camadas</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => addLayer("text")}>
              <Plus className="size-4" /> Texto
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => addLayer("icon")}>
              <Plus className="size-4" /> Ícone
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => addLayer("shape")}>
              <Plus className="size-4" /> Forma
            </Button>
          </div>
          <div className="mt-3 max-h-40 space-y-1 overflow-y-auto">
            {!design.layers.length && (
              <p className="rounded-md px-3 py-2 text-sm text-muted-foreground">
                Nenhuma camada. Adicione texto, ícone ou forma para começar.
              </p>
            )}
            {design.layers
              .map((layer, index) => ({ layer, index }))
              .reverse()
              .map(({ layer, index }) => (
                <button
                  key={`${index}:${layer.id}`}
                  type="button"
                  aria-pressed={selectedLayerIndex === index}
                  onClick={() => selectLayer(index)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm ${selectedLayerIndex === index ? "bg-primary/15 text-primary" : "hover:bg-muted"}`}
                >
                  {layer.type === "text"
                    ? layer.text.slice(0, 32) || "Texto"
                    : layer.type === "icon"
                      ? iconLabels[layer.iconKey]
                      : layer.shape}
                </button>
              ))}
          </div>
        </div>

        <Label className="block">
          Cor do fundo
          <Input
            className="mt-1 h-10 p-1"
            type="color"
            value={design.background}
            onChange={(event) => onChange({ ...design, background: event.target.value })}
          />
        </Label>

        <div className="space-y-2">
          <Label className="block">Imagem de fundo (opcional)</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => bgImageInputRef.current?.click()}
            >
              <ImageIcon className="size-4" />
              {design.backgroundImage ? "Trocar imagem" : "Adicionar imagem"}
            </Button>
            {design.backgroundImage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange({ ...design, backgroundImage: null })}
              >
                <Trash2 className="size-4" />
                Usar só a cor
              </Button>
            )}
          </div>
          {bgImageError && (
            <p role="alert" className="text-sm text-destructive">
              {bgImageError}
            </p>
          )}
          <input
            ref={bgImageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            aria-label="Selecionar imagem de fundo"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setBgImageError(null);
              if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
                setBgImageError("Escolha uma imagem PNG, JPEG ou WebP.");
                return;
              }
              if (file.size > 3 * 1024 * 1024) {
                setBgImageError("A imagem deve ter no máximo 3 MB.");
                return;
              }
              const dataUrl = await new Promise<string | null>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);
              });
              if (!dataUrl) {
                setBgImageError("Não foi possível ler a imagem.");
                return;
              }
              onChange({ ...design, backgroundImage: dataUrl });
            }}
          />
        </div>

        {selected && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Editar camada</h2>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Remover camada"
                onClick={() => {
                  onChange({
                    ...design,
                    layers: design.layers.filter((_, index) => index !== selectedLayerIndex),
                  });
                  onSelect(null);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            {selected.type === "text" && (
              <>
                <Label>
                  Texto
                  <Textarea
                    className="mt-1"
                    rows={4}
                    value={selected.text}
                    onChange={(event) => patchLayer({ text: event.target.value })}
                  />
                </Label>
                <Label>
                  Fonte
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                    value={selected.font}
                    onChange={(event) =>
                      patchLayer({ font: event.target.value as (typeof OUTREACH_FONTS)[number] })
                    }
                  >
                    {OUTREACH_FONTS.map((font) => (
                      <option key={font} value={font}>
                        {outreachFontFamily(font)}
                      </option>
                    ))}
                  </select>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <Label>
                    Tamanho
                    <Input
                      className="mt-1"
                      type="number"
                      min={8}
                      max={300}
                      value={selected.fontSize}
                      onChange={(event) => patchLayer({ fontSize: Number(event.target.value) })}
                    />
                  </Label>
                  <Label>
                    Cor
                    <Input
                      className="mt-1 h-10 p-1"
                      type="color"
                      value={selected.color}
                      onChange={(event) => patchLayer({ color: event.target.value })}
                    />
                  </Label>
                </div>
              </>
            )}
            {selected.type === "icon" && (
              <>
                <div>
                  <Label className="mb-1 block">Ícone</Label>
                  <IconPicker
                    value={selected.iconKey}
                    onChange={(iconKey) => patchLayer({ iconKey })}
                  />
                </div>
                <Label>
                  Cor
                  <Input
                    className="mt-1 h-10 p-1"
                    type="color"
                    value={selected.color}
                    onChange={(event) => patchLayer({ color: event.target.value })}
                  />
                </Label>
              </>
            )}
            {selected.type === "shape" && (
              <>
                <Label>
                  Forma
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                    value={selected.shape}
                    onChange={(event) =>
                      patchLayer({ shape: event.target.value as typeof selected.shape })
                    }
                  >
                    <option value="rectangle">Retângulo</option>
                    <option value="circle">Círculo</option>
                    <option value="line">Linha</option>
                  </select>
                </Label>
                <Label>
                  Preenchimento
                  <Input
                    className="mt-1 h-10 p-1"
                    type="color"
                    value={selected.fill}
                    onChange={(event) => patchLayer({ fill: event.target.value })}
                  />
                </Label>
              </>
            )}
          </div>
        )}
      </aside>
      <Button
        type="button"
        className="fixed bottom-4 left-4 right-4 z-30 h-12 shadow-xl lg:hidden"
        onClick={() => setMobileControlsOpen(true)}
      >
        <SlidersHorizontal className="size-4" /> Editar arte
      </Button>
    </div>
  );
}
