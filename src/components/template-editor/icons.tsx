import {
  Bell,
  Camera,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Crown,
  Flame,
  Gift,
  Heart,
  MapPin,
  MessageCircle,
  Percent,
  Scissors,
  Smile,
  Sparkles,
  Star,
  Phone,
  Tag,
  ThumbsUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { OutreachDesignLayer } from "@/lib/outreach-design";

const lucideIcons = {
  scissors: Scissors,
  calendar: CalendarDays,
  clock: Clock3,
  star: Star,
  sparkles: Sparkles,
  "map-pin": MapPin,
  phone: Phone,
  check: CheckCircle2,
  heart: Heart,
  gift: Gift,
  crown: Crown,
  bell: Bell,
  tag: Tag,
  "thumbs-up": ThumbsUp,
  users: Users,
  smile: Smile,
  camera: Camera,
  flame: Flame,
  percent: Percent,
} satisfies Record<string, LucideIcon>;

const pickerGlyphs = { ...lucideIcons, whatsapp: MessageCircle } satisfies Record<
  string,
  LucideIcon
>;

/** Versão HTML (fora do SVG da arte) usada no seletor de ícones do painel. */
export function TemplateIconGlyph({
  iconKey,
  className,
}: {
  iconKey: keyof typeof pickerGlyphs;
  className?: string;
}) {
  const Icon = pickerGlyphs[iconKey];
  return Icon ? <Icon className={className} aria-hidden="true" /> : null;
}

export function TemplateIcon({ layer }: { layer: Extract<OutreachDesignLayer, { type: "icon" }> }) {
  const Icon = lucideIcons[layer.iconKey as keyof typeof lucideIcons];
  return Icon ? (
    <Icon
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      color={layer.color}
      strokeWidth={2}
      opacity={layer.opacity}
      transform={
        layer.rotation
          ? `rotate(${layer.rotation} ${layer.x + layer.width / 2} ${layer.y + layer.height / 2})`
          : undefined
      }
    />
  ) : (
    <g
      transform={`translate(${layer.x} ${layer.y}) scale(${layer.width / 24} ${layer.height / 24})`}
      opacity={layer.opacity}
    >
      <path
        d="M20.52 3.48A11.9 11.9 0 0 0 12.04 0C5.5 0 .18 5.31.18 11.86c0 2.09.55 4.12 1.6 5.91L.08 24l6.39-1.68a11.9 11.9 0 0 0 5.56 1.41h.01c6.54 0 11.86-5.32 11.86-11.86 0-3.17-1.24-6.14-3.38-8.39ZM12.04 21.7h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.79 1 1.01-3.7-.24-.38a9.86 9.86 0 0 1-1.51-5.17c0-5.48 4.46-9.94 9.95-9.94a9.87 9.87 0 0 1 7.04 2.92 9.87 9.87 0 0 1 2.91 7.03c0 5.48-4.46 9.94-9.96 9.94Zm5.46-7.45c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.96 1.18-.17.2-.35.23-.65.08-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.68-2.08-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.07-.15-.68-1.64-.93-2.24-.24-.58-.49-.5-.68-.51h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.52s1.08 2.92 1.23 3.12c.15.2 2.13 3.25 5.16 4.55.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.08-.13-.28-.2-.58-.35Z"
        fill={layer.color}
        transform={layer.rotation ? `rotate(${layer.rotation} 12 12)` : undefined}
      />
    </g>
  );
}
