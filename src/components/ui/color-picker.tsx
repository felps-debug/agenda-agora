import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Pipette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  // Seletor customizado (gradiente + conta-gotas) apenas no Android; no computador
  // fica o seletor nativo do navegador, como era antes.
  const [useCustomPicker, setUseCustomPicker] = useState(false);
  useEffect(() => {
    const isMobile =
      /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || "ontouchstart" in window;
    if (isMobile) setUseCustomPicker(true);
  }, []);
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const areaRef = useRef<HTMLDivElement | null>(null);
  const draggingArea = useRef(false);
  const draggingHue = useRef(false);

  useEffect(() => {
    setHsv(hexToHsv(value));
  }, [value]);

  const applyHsv = (next: { h: number; s: number; v: number }) => {
    setHsv(next);
    onChange(hsvToHex(next.h, next.s, next.v));
  };

  const updateArea = (clientX: number, clientY: number) => {
    const el = areaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    applyHsv({ ...hsv, s, v });
  };

  const updateHue = (clientX: number) => {
    const el = areaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // hue slider is full width below; reuse area width
    const h = Math.max(0, Math.min(360, ((clientX - rect.left) / rect.width) * 360));
    applyHsv({ ...hsv, h });
  };

  const handleEyedropper = async () => {
    if (typeof window !== "undefined" && "EyeDropper" in window) {
      setOpen(false);
      window.dispatchEvent(new Event("appearance-eyedropper-start"));
      try {
        const dropper = new (window as any).EyeDropper();
        const result = await dropper.open();
        if (result?.sRGBHex) onChange(result.sRGBHex);
      } catch {
        // cancelled
      } finally {
        window.dispatchEvent(new Event("appearance-eyedropper-end"));
        setOpen(true);
      }
    }
  };

  const rgb = hexToRgb(hsvToHex(hsv.h, hsv.s, hsv.v));

  if (!useCustomPicker) {
    return (
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
        onChange={(event) => onChange(event.target.value)}
        className="size-9 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-0.5"
        aria-label="Selecionar cor"
      />
    );
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="size-9 rounded-lg border border-input"
        style={{ backgroundColor: value }}
        aria-label="Selecionar cor"
      />
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl border bg-background p-4 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              ref={areaRef}
              className="relative h-40 w-full cursor-crosshair rounded-xl"
              style={{
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)`,
                backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
                touchAction: "none",
              }}
              onPointerDown={(e) => {
                draggingArea.current = true;
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                updateArea(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (draggingArea.current) updateArea(e.clientX, e.clientY);
              }}
              onPointerUp={() => {
                draggingArea.current = false;
              }}
            >
              <span
                className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                style={{
                  left: `${hsv.s * 100}%`,
                  top: `${(1 - hsv.v) * 100}%`,
                  backgroundColor: value,
                }}
              />
            </div>

            <div
              className="mt-3 h-3 w-full cursor-pointer rounded-full"
              style={{
                background:
                  "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
                touchAction: "none",
              }}
              onPointerDown={(e) => {
                draggingHue.current = true;
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                updateHue(e.clientX);
              }}
              onPointerMove={(e) => {
                if (draggingHue.current) updateHue(e.clientX);
              }}
              onPointerUp={() => {
                draggingHue.current = false;
              }}
            />

            <div className="mt-3 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleEyedropper}
                aria-label="Conta-gotas"
              >
                <Pipette className="size-4" />
              </Button>
              <Input
                value={value}
                onChange={(e) => {
                  if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value);
                }}
                className="flex-1"
                aria-label="HEX"
              />
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["r", "g", "b"] as const).map((ch) => (
                <label key={ch} className="text-xs">
                  {ch.toUpperCase()}
                  <Input
                    type="number"
                    min={0}
                    max={255}
                    value={rgb[ch]}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(255, Number(e.target.value)));
                      const next = { ...rgb, [ch]: v };
                      onChange(
                        `#${next.r.toString(16).padStart(2, "0")}${next.g.toString(16).padStart(2, "0")}${next.b.toString(16).padStart(2, "0")}`,
                      );
                    }}
                  />
                </label>
              ))}
            </div>

            <div className="mt-3 flex justify-end">
              <Button type="button" size="sm" onClick={() => setOpen(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
