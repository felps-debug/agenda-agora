import { useRef, useState } from "react";
import { friendlyError } from "@/lib/error-page";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Instagram, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  LOGO_ACCEPT,
  LOGO_BUCKET,
  decodeBusinessImageFile,
  getLogoUrl,
  logoStorageErrorMessage,
  saveBusinessLogo,
  validateLogoFile,
} from "@/lib/logo";
import { getPanel1Config } from "@/lib/panel1-config.functions";
import { DEFAULT_PANEL1_APPEARANCE } from "@/lib/panel1-config";
import { Button } from "@/components/ui/button";

export function AppearanceSettings({
  businessId,
  onSaveStart: _onSaveStart,
  onSaveComplete: _onSaveComplete,
  onSaveError: _onSaveError,
}: {
  businessId: string;
  onSaveStart: () => void;
  onSaveComplete: () => void;
  onSaveError: () => void;
}) {
  const queryClient = useQueryClient();
  const getConfigFn = useServerFn(getPanel1Config);
  const saveLogoFn = useServerFn(saveBusinessLogo);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["panel1-appearance", businessId],
    queryFn: async () => {
      const [{ data: business, error }, config] = await Promise.all([
        supabase
          .from("businesses")
          .select("logo_url, brand_background")
          .eq("id", businessId)
          .maybeSingle(),
        getConfigFn({ data: { businessId } }),
      ]);
      if (error) throw error;
      return {
        logoPath: business?.logo_url ?? null,
        logoUrl: await getLogoUrl(business?.logo_url ?? null, businessId),
        background: business?.brand_background ?? "#050607",
        appearance: config.appearance,
      };
    },
  });
  const appearance = data?.appearance ?? DEFAULT_PANEL1_APPEARANCE;

  const upload = useMutation({
    mutationFn: async ({ file, extension }: { file: File; extension: string }) => {
      const uploadPath = `${businessId}/logo-${crypto.randomUUID()}.${extension}`;
      const result = await supabase.storage.from(LOGO_BUCKET).upload(uploadPath, file, {
        upsert: false,
        contentType: file.type,
      });
      if (result.error) throw new Error(logoStorageErrorMessage(result.error));
      await saveLogoFn({ data: { businessId, path: uploadPath } });
      if (data?.logoPath) {
        try {
          await supabase.storage.from(LOGO_BUCKET).remove([data.logoPath]);
        } catch {
          // A imagem anterior pode ser limpa depois sem desfazer a nova logo.
        }
      }
    },
    onSuccess: async () => {
      toast.success("Logotipo atualizado.");
      await queryClient.invalidateQueries({ queryKey: ["panel1-appearance", businessId] });
    },
    onError: (error: Error) => {
      setLogoError(friendlyError(error));
      toast.error(friendlyError(error));
    },
    onSettled: () => setBusy(false),
  });

  if (isLoading) return <p role="status">Carregando pré-visualização...</p>;
  if (isError)
    return <p role="alert">Não foi possível carregar a aparência. Tente atualizar a página.</p>;

  const previewServices = ["R$ 25,00 · 30 min", "R$ 45,00 · 40 min", "R$ 80,00 · 60 min"];
  return (
    <div className="mx-auto w-full max-w-[650px] space-y-5 bg-[#4a4a4a] px-4 pb-9 pt-7 sm:px-8">
      <input
        ref={inputRef}
        type="file"
        accept={LOGO_ACCEPT}
        className="hidden"
        aria-label="Selecionar logotipo"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file || busy) return;
          setBusy(true);
          setLogoError(null);
          const validation = await validateLogoFile(file);
          if (!validation.valid) {
            setBusy(false);
            setLogoError(validation.message);
            toast.error(validation.message);
            return;
          }
          if (!(await decodeBusinessImageFile(file))) {
            setBusy(false);
            const message =
              "Não foi possível abrir a imagem. Escolha um arquivo PNG, JPEG ou WebP válido.";
            setLogoError(message);
            toast.error(message);
            return;
          }
          setBusy(true);
          upload.mutate({ file, extension: validation.extension });
        }}
      />

      <section
        className="mx-auto w-full max-w-[448px] rounded-xl px-5 pb-6 pt-8"
        style={{ backgroundColor: data?.background, color: appearance.page_text }}
      >
        <button
          type="button"
          onClick={() => !busy && inputRef.current?.click()}
          disabled={busy}
          title="Clique para trocar o logotipo"
          aria-label="Trocar logotipo"
          className="mx-auto flex min-h-[78px] w-full max-w-[270px] items-center justify-center bg-transparent p-0 disabled:cursor-wait"
        >
          {data?.logoUrl ? (
            <img
              src={data.logoUrl}
              alt="Logotipo"
              loading="lazy"
              decoding="async"
              className="max-h-[76px] max-w-full object-contain"
            />
          ) : (
            <span className="text-sm font-medium opacity-60">
              {busy ? "Enviando..." : "SUA LOGO"}
            </span>
          )}
        </button>
        <p className="mt-2 text-center text-xs opacity-80">PNG, JPEG ou WebP, até 5 MB.</p>
        {logoError && (
          <p
            role="alert"
            className="mt-2 rounded bg-red-950 px-3 py-2 text-center text-sm text-red-50"
          >
            {logoError}
          </p>
        )}
        <button
          type="button"
          className="mt-5 block w-full text-center text-[28px] font-medium leading-none"
          style={{ backgroundColor: appearance.header_background, color: appearance.header_title }}
        >
          SERVIÇOS
        </button>
        <div className="mx-auto mt-6 w-full max-w-[306px] space-y-6">
          {previewServices.map((price, index) => (
            <article
              key={price}
              className="flex min-h-[112px] flex-col items-center justify-center rounded-lg border-2 px-4 py-3 text-center"
              style={{
                backgroundColor: appearance.service_background,
                color: appearance.service_text,
                borderColor: appearance.service_border,
              }}
            >
              <p className="text-base font-medium" style={{ color: appearance.service_name_text }}>
                Serviço de exemplo {index + 1}
              </p>
              <p
                className="mt-7 text-base font-semibold"
                style={{ color: appearance.service_price_text }}
              >
                {price}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-center gap-2.5">
          <MapPin className="size-8" />
          <Instagram className="size-8" />
        </div>
      </section>
      <div className="mx-auto flex w-full max-w-[448px] justify-center">
        <Button asChild>
          <a href="/painel/aparencia-editor">Editar aparência</a>
        </Button>
      </div>
    </div>
  );
}
