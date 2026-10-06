import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LOGO_BUCKET } from "@/lib/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type BubbleProfessional = {
  id: string;
  name: string;
  avatar_path: string | null;
};

function useAvatarUrl(path: string | null) {
  return useQuery({
    queryKey: ["professional-avatar", path],
    enabled: !!path,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(LOGO_BUCKET).createSignedUrl(path!, 3600);
      if (error) return null;
      return data.signedUrl;
    },
  });
}

export function ProfessionalAvatar({
  professional,
  className,
}: {
  professional: BubbleProfessional;
  className?: string;
}) {
  const { data: url } = useAvatarUrl(professional.avatar_path);
  return (
    <Avatar className={cn("size-full bg-[#d4d6da] text-[#6b6f76]", className)}>
      {url ? <AvatarImage src={url} alt={professional.name} className="object-cover" /> : null}
      <AvatarFallback className="bg-[#d4d6da] text-[#6b6f76]">
        <User className="size-3/5" aria-hidden="true" />
      </AvatarFallback>
    </Avatar>
  );
}

export function ProfessionalBubbles({
  professionals,
  selectedId,
  onSelect,
}: {
  professionals: BubbleProfessional[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (professionals.length < 2) return null;
  return (
    <div
      role="tablist"
      aria-label="Profissionais"
      className="mt-3 flex items-center justify-center gap-3 overflow-x-auto py-2"
    >
      {professionals.map((p) => {
        const active = p.id === selectedId;
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={p.name}
            title={p.name}
            onClick={() => onSelect(p.id)}
            className={cn(
              "size-14 shrink-0 rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "scale-110 ring-2 ring-white shadow-[0_0_14px_rgba(255,255,255,0.35)]"
                : "opacity-60 hover:opacity-90",
            )}
          >
            <ProfessionalAvatar professional={p} />
          </button>
        );
      })}
    </div>
  );
}
