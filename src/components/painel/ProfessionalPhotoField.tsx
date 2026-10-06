import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LOGO_ACCEPT, LOGO_BUCKET, validateLogoFile } from "@/lib/logo";
import { friendlyError } from "@/lib/error-page";
import { Button } from "@/components/ui/button";
import { ProfessionalAvatar } from "@/components/painel/ProfessionalBubbles";

/** Caminho no bucket privado; a policy de storage só aceita este formato. */
export function professionalPhotoPath(businessId: string, extension: string) {
  return `${businessId}/professional/${crypto.randomUUID()}.${extension}`;
}

export function ProfessionalPhotoField({
  businessId,
  name,
  avatarPath,
  onChange,
}: {
  businessId: string;
  name: string;
  avatarPath: string | null;
  onChange: (path: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File) => {
    setBusy(true);
    try {
      const validation = await validateLogoFile(file);
      if (!validation.valid) {
        toast.error("Escolha uma foto PNG, JPEG ou WebP de até 5 MB.");
        return;
      }
      const path = professionalPhotoPath(businessId, validation.extension);
      const { error } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw new Error("Não foi possível enviar a foto. Tente novamente.");
      onChange(path);
    } catch (error) {
      toast.error(friendlyError(error as Error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="size-16 shrink-0 overflow-hidden rounded-full">
        <ProfessionalAvatar professional={{ id: "preview", name, avatar_path: avatarPath }} />
      </div>
      <div className="space-y-1">
        <input
          ref={inputRef}
          type="file"
          accept={LOGO_ACCEPT}
          className="hidden"
          aria-label="Selecionar foto do profissional"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void pick(file);
          }}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="mr-1.5 size-4" />
            {busy ? "Enviando…" : avatarPath ? "Trocar foto" : "Adicionar foto"}
          </Button>
          {avatarPath ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              Remover
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPEG ou WebP, até 5 MB.</p>
      </div>
    </div>
  );
}
