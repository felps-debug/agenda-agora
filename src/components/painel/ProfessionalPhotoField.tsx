import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  LOGO_ACCEPT,
  LOGO_BUCKET,
  decodeBusinessImageFile,
  validateLogoFile,
} from "@/lib/logo";
import { friendlyError } from "@/lib/error-page";
import { Button } from "@/components/ui/button";
import { ProfessionalAvatar } from "@/components/painel/ProfessionalBubbles";
import { ImageCropDialog } from "@/components/painel/ImageCropDialog";

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
  const [cropOpen, setCropOpen] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const uploadCropped = async (blob: Blob, extension: "png" | "jpg") => {
    if (!businessId) return;
    const type = extension === "png" ? "image/png" : "image/jpeg";
    const file = new File([blob], `recorte.${extension}`, { type });
    setBusy(true);
    try {
      const signature = await validateLogoFile(file);
      if (!signature.valid) {
        setImageError(signature.message);
        return;
      }
      if (!(await decodeBusinessImageFile(file))) {
        setImageError("O arquivo não contém uma imagem válida. Escolha outra imagem.");
        return;
      }
      setImageError(null);
      const path = professionalPhotoPath(businessId, signature.extension);
      const { error } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) {
        setImageError("Não foi possível enviar a foto. Tente novamente.");
        return;
      }
      onChange(path);
      setCropOpen(false);
      setCropFile(null);
      setImageError(null);
    } catch (error) {
      console.error("Erro ao enviar foto recortada:", error);
      setImageError("Não foi possível enviar a foto. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const handleImageSelect = async (file?: File) => {
    if (!file || !businessId) return;
    setImageError(null);
    const signature = await validateLogoFile(file);
    if (!signature.valid) {
      setImageError(signature.message);
      toast.error("Escolha uma foto PNG, JPEG ou WebP de até 5 MB.");
      return;
    }
    setCropFile(file);
    setCropOpen(true);
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
            if (file) void handleImageSelect(file);
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
        {imageError && (
          <p role="alert" className="text-sm text-destructive">
            {imageError}
          </p>
        )}
      </div>

      <ImageCropDialog
        open={cropOpen}
        file={cropFile}
        busy={busy}
        error={imageError}
        onCancel={() => {
          setCropOpen(false);
          setCropFile(null);
          setImageError(null);
        }}
        onConfirm={(blob, extension) => {
          void uploadCropped(blob, extension);
        }}
      />
    </div>
  );
}
