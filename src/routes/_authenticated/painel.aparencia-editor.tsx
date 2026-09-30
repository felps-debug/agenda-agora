import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AppearanceEditor } from "@/components/painel/AppearanceEditor";
import type { PreviewService } from "@/components/public-booking/appearance-preview";
import { Button } from "@/components/ui/button";
import { useBusiness } from "@/lib/business";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/error-page";
import {
  LOGO_BUCKET,
  clearBusinessBackgroundImage,
  decodeBusinessImageFile,
  getBackgroundImageUrl,
  getLogoUrl,
  logoStorageErrorMessage,
  saveBusinessBackgroundImage,
  saveBusinessLogo,
  validateLogoFile,
} from "@/lib/logo";
import { effectiveDepositCents, type DepositMode } from "@/lib/deposit-amount";
import {
  applyPanel1AppearancePreset,
  DEFAULT_PANEL1_APPEARANCE,
  type Panel1Appearance,
} from "@/lib/panel1-config";
import { getPanel1Config, savePanel1Config } from "@/lib/panel1-config.functions";
import { updateBusinessProfile } from "@/lib/business.functions";

const DEFAULT_PAGE_BACKGROUND = "#ffffff";

export const Route = createFileRoute("/_authenticated/painel/aparencia-editor")({
  component: AppearanceEditorPage,
});

function AppearanceEditorPage() {
  const { businessId, business } = useBusiness();
  const queryClient = useQueryClient();
  const getFn = useServerFn(getPanel1Config);
  const saveFn = useServerFn(savePanel1Config);
  const updateProfileFn = useServerFn(updateBusinessProfile);
  const saveLogoFn = useServerFn(saveBusinessLogo);
  const saveBackgroundImageFn = useServerFn(saveBusinessBackgroundImage);
  const clearBackgroundImageFn = useServerFn(clearBusinessBackgroundImage);
  const [appearance, setAppearance] = useState<Panel1Appearance>(DEFAULT_PANEL1_APPEARANCE);
  const [pageBackground, setPageBackground] = useState(DEFAULT_PAGE_BACKGROUND);

  const config = useQuery({
    queryKey: ["panel1-config", businessId],
    enabled: !!businessId,
    queryFn: () => getFn({ data: { businessId: businessId! } }),
  });
  useEffect(() => {
    if (config.data) setAppearance(config.data.appearance);
  }, [config.data]);

  const profile = useQuery({
    queryKey: ["business-appearance-profile", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("logo_url, brand_background, brand_background_image")
        .eq("id", businessId!)
        .maybeSingle();
      if (error) throw error;
      return {
        logoPath: data?.logo_url ?? null,
        logoUrl: await getLogoUrl(data?.logo_url ?? null, businessId!),
        brandBackground: data?.brand_background ?? DEFAULT_PAGE_BACKGROUND,
        backgroundImageUrl: await getBackgroundImageUrl(
          data?.brand_background_image ?? null,
          businessId!,
        ),
      };
    },
  });
  useEffect(() => {
    if (profile.data) setPageBackground(profile.data.brandBackground);
  }, [profile.data]);

  const [logoUploading, setLogoUploading] = useState(false);
  const [backgroundImageUploading, setBackgroundImageUploading] = useState(false);

  const invalidateProfile = () =>
    queryClient.invalidateQueries({ queryKey: ["business-appearance-profile", businessId] });

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      const validation = await validateLogoFile(file);
      if (!validation.valid) throw new Error(validation.message);
      if (!(await decodeBusinessImageFile(file))) {
        throw new Error("Não foi possível abrir a imagem. Escolha um arquivo PNG, JPEG ou WebP.");
      }
      const uploadPath = `${businessId}/logo-${crypto.randomUUID()}.${validation.extension}`;
      const result = await supabase.storage.from(LOGO_BUCKET).upload(uploadPath, file, {
        upsert: false,
        contentType: file.type,
      });
      if (result.error) throw new Error(logoStorageErrorMessage(result.error));
      await saveLogoFn({ data: { businessId: businessId!, path: uploadPath } });
      if (profile.data?.logoPath) {
        try {
          await supabase.storage.from(LOGO_BUCKET).remove([profile.data.logoPath]);
        } catch {
          // Foto anterior pode ficar órfã; não bloqueia a troca.
        }
      }
    },
    onMutate: () => setLogoUploading(true),
    onSuccess: async () => {
      toast.success("Foto atualizada.");
      await invalidateProfile();
    },
    onError: (error: Error) => toast.error(friendlyError(error, "trocar a foto")),
    onSettled: () => setLogoUploading(false),
  });

  const uploadBackgroundImage = useMutation({
    mutationFn: async (file: File) => {
      const validation = await validateLogoFile(file, "background");
      if (!validation.valid) throw new Error(validation.message);
      if (!(await decodeBusinessImageFile(file))) {
        throw new Error("Não foi possível abrir a imagem. Escolha um arquivo PNG, JPEG ou WebP.");
      }
      const uploadPath = `${businessId}/background-${crypto.randomUUID()}.${validation.extension}`;
      const result = await supabase.storage.from(LOGO_BUCKET).upload(uploadPath, file, {
        upsert: false,
        contentType: file.type,
      });
      if (result.error) throw new Error(logoStorageErrorMessage(result.error));
      await saveBackgroundImageFn({ data: { businessId: businessId!, path: uploadPath } });
    },
    onMutate: () => setBackgroundImageUploading(true),
    onSuccess: async () => {
      toast.success("Imagem de fundo atualizada.");
      await invalidateProfile();
    },
    onError: (error: Error) => toast.error(friendlyError(error, "enviar a imagem de fundo")),
    onSettled: () => setBackgroundImageUploading(false),
  });

  const clearBackgroundImage = useMutation({
    mutationFn: () => clearBackgroundImageFn({ data: { businessId: businessId! } }),
    onSuccess: async () => {
      toast.success("Voltou a usar a cor de fundo.");
      await invalidateProfile();
    },
    onError: (error: Error) => toast.error(friendlyError(error, "remover a imagem de fundo")),
  });

  const dirty = useMemo(() => {
    const appearanceDirty =
      !!config.data && JSON.stringify(appearance) !== JSON.stringify(config.data.appearance);
    const backgroundDirty = !!profile.data && pageBackground !== profile.data.brandBackground;
    return appearanceDirty || backgroundDirty;
  }, [appearance, config.data, pageBackground, profile.data]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const servicesQuery = useQuery({
    queryKey: ["appearance-editor-services", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select(
          "id, name, duration_minutes, price_cents, show_price, show_duration, requires_deposit, deposit_cents, deposit_mode, deposit_percent_bps",
        )
        .eq("business_id", businessId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((s): PreviewService => {
        const row = s as typeof s &
          Partial<{ deposit_mode: DepositMode; deposit_percent_bps: number }>;
        return {
          id: row.id,
          name: row.name,
          duration_minutes: row.duration_minutes,
          price_cents: row.price_cents,
          show_price: row.show_price,
          show_duration: row.show_duration,
          effectiveDepositCents: effectiveDepositCents({
            requires_deposit: row.requires_deposit,
            deposit_mode: row.deposit_mode === "percent" ? "percent" : "fixed",
            deposit_percent_bps: row.deposit_percent_bps ?? 0,
            price_cents: row.price_cents,
            deposit_cents: row.deposit_cents,
          }),
        };
      });
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const backgroundChanged = !!profile.data && pageBackground !== profile.data.brandBackground;
      await Promise.all([
        saveFn({ data: { businessId: businessId!, patch: { appearance } } }),
        backgroundChanged
          ? updateProfileFn({ data: { businessId: businessId!, brand_background: pageBackground } })
          : Promise.resolve(),
      ]);
    },
    onSuccess: async () => {
      toast.success("Aparência salva.");
      await queryClient.invalidateQueries({ queryKey: ["panel1-config", businessId] });
      await queryClient.invalidateQueries({ queryKey: ["panel1-appearance", businessId] });
      await queryClient.invalidateQueries({
        queryKey: ["business-appearance-profile", businessId],
      });
    },
    onError: () => toast.error("Não foi possível salvar a aparência. Tente novamente."),
  });

  if (!businessId) return <p className="p-6">Selecione um negócio para editar a aparência.</p>;
  if (config.isLoading)
    return (
      <p role="status" className="p-6">
        Carregando editor...
      </p>
    );
  if (config.isError)
    return (
      <p role="alert" className="p-6">
        Não foi possível carregar a aparência. Atualize a página.
      </p>
    );

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar ao painel">
          <Link
            to="/painel"
            onClick={(event) => {
              if (
                dirty &&
                !window.confirm("Você tem alterações de aparência não salvas. Sair mesmo assim?")
              ) {
                event.preventDefault();
              }
            }}
          >
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Editar aparência</h1>
          <p className="text-sm text-muted-foreground">Pré-visualize as cores antes de salvar.</p>
        </div>
      </header>
      <AppearanceEditor
        appearance={appearance}
        onChange={setAppearance}
        onApplyPreset={(preset) =>
          setAppearance((current) => applyPanel1AppearancePreset(current, preset))
        }
        onSave={() => save.mutate()}
        saving={save.isPending}
        businessName={business?.name ?? ""}
        businessLogoUrl={profile.data?.logoUrl ?? null}
        businessAddress={business?.address ?? null}
        services={servicesQuery.data ?? []}
        pageBackground={pageBackground}
        onPageBackgroundChange={setPageBackground}
        onLogoFileSelected={(file) => uploadLogo.mutate(file)}
        logoUploading={logoUploading}
        backgroundImageUrl={profile.data?.backgroundImageUrl ?? null}
        onBackgroundImageFileSelected={(file) => uploadBackgroundImage.mutate(file)}
        onClearBackgroundImage={() => clearBackgroundImage.mutate()}
        backgroundImageUploading={backgroundImageUploading}
      />
      {save.isError && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível salvar a aparência. Tente novamente.
        </p>
      )}
    </main>
  );
}
