import { useRef, useState } from "react";
import { friendlyError } from "@/lib/error-page";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
import { getPublicBookingCatalog } from "@/lib/booking.functions";
import { DEFAULT_PANEL1_APPEARANCE } from "@/lib/panel1-config";
import { Button } from "@/components/ui/button";
import { ElegancePanel, EleganceServiceList } from "@/components/public-booking/elegance";

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
  const getCatalogFn = useServerFn(getPublicBookingCatalog);
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
          .select("name, slug, logo_url, brand_background")
          .eq("id", businessId)
          .maybeSingle(),
        getConfigFn({ data: { businessId } }),
      ]);
      if (error) throw error;
      const catalog = await getCatalogFn({ data: { slug: business?.slug ?? "" } });
      return {
        logoPath: business?.logo_url ?? null,
        logoUrl: await getLogoUrl(business?.logo_url ?? null, businessId),
        catalog,
        brandBackground: business?.brand_background ?? null,
        appearance: config.appearance,
      };
    },
  });
  const appearance = data?.catalog?.appearance ?? data?.appearance ?? DEFAULT_PANEL1_APPEARANCE;

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

  const catalog = data?.catalog;
  const business = catalog?.business;
  const layoutKey = catalog?.visual?.layout_key ?? "classic";
  const logoUrl = data?.logoUrl ?? business?.logo_url ?? null;
  return (
    <div className="space-y-4">
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

      {/* Prévia ao vivo — mesmo enquadramento do Editor do Painel 1. */}
      <div className="rounded-2xl border border-[#25282c] bg-[var(--c-0f172a)] p-2 shadow-inner sm:p-3">
        <div className="mx-auto flex max-w-[430px] flex-col overflow-hidden rounded-[1.5rem] border-4 border-[var(--c-020617)] bg-background shadow-2xl sm:rounded-[2rem] sm:border-8">
          <div
            className="flex flex-1 min-h-full flex-col [&>div]:flex-1"
            style={{ backgroundColor: data?.brandBackground ?? business?.brand_background ?? "#ffffff" }}
          >
            <ElegancePanel
              appearance={appearance}
              brandName={business?.name ?? "Nome do negócio"}
              logoUrl={logoUrl}
              coverUrl={business?.brand_background_image ?? null}
              pageBackground={data?.brandBackground ?? business?.brand_background ?? "#ffffff"}
              activeTab="agendar"
              fullHeight={false}
              minimalist={layoutKey === "classic"}
              onAppearanceTargetSelect={(target) => {
                if (target === "logo-cover" && !busy) inputRef.current?.click();
              }}
            >
              <EleganceServiceList
                services={catalog?.services ?? []}
                onSelect={() => {}}
                appearance={appearance}
              />
            </ElegancePanel>
          </div>
        </div>
      </div>
      <div className="mx-auto text-center text-xs text-white/70">
        Clique na logo para trocar. A prévia mostra o painel atual do cliente em tempo real.
      </div>
      {logoError && (
        <p
          role="alert"
          className="mx-auto max-w-[520px] rounded bg-red-950 px-3 py-2 text-center text-sm text-red-50"
        >
          {logoError}
        </p>
      )}
      <div className="mx-auto flex w-full max-w-[448px] justify-center">
        <Button asChild>
          <a href="/painel/aparencia-editor">Editar aparência</a>
        </Button>
      </div>
    </div>
  );
}
