import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppearanceEditor } from "@/components/painel/AppearanceEditor";
import type { PreviewService } from "@/components/public-booking/appearance-preview";
import { useBusiness } from "@/lib/business";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/error-page";
import {
  LOGO_BUCKET,
  clearBusinessBackgroundImage,
  decodeBusinessImageFile,
  getBackgroundImageUrl,
  getBusinessImageUrl,
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
  DEFAULT_PANEL1_VISUAL_PREFERENCES,
  PANEL1_PRESET_DETAILS,
  type Panel1Appearance,
  type Panel1VisualPreferences,
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
  const [visual, setVisual] = useState<Panel1VisualPreferences>(DEFAULT_PANEL1_VISUAL_PREFERENCES);
  const [pageBackground, setPageBackground] = useState(DEFAULT_PAGE_BACKGROUND);

  const config = useQuery({
    queryKey: ["panel1-config", businessId],
    enabled: !!businessId,
    queryFn: () => getFn({ data: { businessId: businessId! } }),
  });
  useEffect(() => {
    if (config.data) {
      setAppearance(config.data.appearance);
      setVisual(config.data.visual);
    }
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
        backgroundImagePath: data?.brand_background_image ?? null,
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
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingBackgroundFile, setPendingBackgroundFile] = useState<File | null>(null);
  const [removeBackgroundImage, setRemoveBackgroundImage] = useState(false);
  const [pendingLogoUrl, setPendingLogoUrl] = useState<string | null>(null);
  const [pendingBackgroundUrl, setPendingBackgroundUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingLogoFile) {
      setPendingLogoUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingLogoFile);
    setPendingLogoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingLogoFile]);

  useEffect(() => {
    if (!pendingBackgroundFile) {
      setPendingBackgroundUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingBackgroundFile);
    setPendingBackgroundUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingBackgroundFile]);

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
    const visualDirty =
      !!config.data && JSON.stringify(visual) !== JSON.stringify(config.data.visual);
    const backgroundDirty = !!profile.data && pageBackground !== profile.data.brandBackground;
    return (
      appearanceDirty ||
      visualDirty ||
      backgroundDirty ||
      !!pendingLogoFile ||
      !!pendingBackgroundFile ||
      removeBackgroundImage
    );
  }, [
    appearance,
    config.data,
    pageBackground,
    pendingBackgroundFile,
    pendingLogoFile,
    profile.data,
    removeBackgroundImage,
    visual,
  ]);

  useBlocker({
    shouldBlockFn: () =>
      dirty && !window.confirm("Você tem alterações de aparência não salvas. Sair mesmo assim?"),
    enableBeforeUnload: dirty,
  });

  const servicesQuery = useQuery({
    queryKey: ["appearance-editor-services", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select(
          "id, name, duration_minutes, price_cents, image_path, show_price, show_duration, requires_deposit, deposit_cents, deposit_mode, deposit_percent_bps",
        )
        .eq("business_id", businessId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return await Promise.all(
        (data ?? []).map(async (s): Promise<PreviewService> => {
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
            image_url: await getBusinessImageUrl(row.image_path, businessId!, "service"),
          };
        }),
      );
    },
  });

  const uploadQueuedImage = async (file: File, kind: "logo" | "background") => {
    if (!businessId) throw new Error("Selecione um negócio para publicar a aparência.");
    const validation = await validateLogoFile(file, kind === "background" ? "background" : "logo");
    if (!validation.valid) throw new Error(validation.message);
    if (!(await decodeBusinessImageFile(file))) {
      throw new Error("Não foi possível abrir a imagem. Escolha um arquivo PNG, JPEG ou WebP.");
    }
    const uploadPath = [
      businessId,
      kind + "-" + crypto.randomUUID() + "." + validation.extension,
    ].join("/");
    const result = await supabase.storage.from(LOGO_BUCKET).upload(uploadPath, file, {
      upsert: false,
      contentType: file.type,
    });
    if (result.error) throw new Error(logoStorageErrorMessage(result.error));
    return uploadPath;
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("Selecione um negócio para publicar a aparência.");
      const backgroundChanged = !!profile.data && pageBackground !== profile.data.brandBackground;
      if (pendingLogoFile) {
        const path = await uploadQueuedImage(pendingLogoFile, "logo");
        await saveLogoFn({ data: { businessId, path } });
        if (profile.data?.logoPath) {
          await supabase.storage
            .from(LOGO_BUCKET)
            .remove([profile.data.logoPath])
            .catch(() => {});
        }
      }
      if (pendingBackgroundFile) {
        const path = await uploadQueuedImage(pendingBackgroundFile, "background");
        await saveBackgroundImageFn({ data: { businessId, path } });
      } else if (removeBackgroundImage && profile.data?.backgroundImagePath) {
        await clearBackgroundImageFn({ data: { businessId } });
      }
      await Promise.all([
        saveFn({ data: { businessId, patch: { appearance, visual } } }),
        backgroundChanged
          ? updateProfileFn({ data: { businessId, brand_background: pageBackground } })
          : Promise.resolve(),
      ]);
    },
    onSuccess: async () => {
      setPendingLogoFile(null);
      setPendingBackgroundFile(null);
      setRemoveBackgroundImage(false);
      toast.success("Alterações aplicadas.");
      await queryClient.invalidateQueries({ queryKey: ["panel1-config", businessId] });
      await queryClient.invalidateQueries({ queryKey: ["panel1-appearance", businessId] });
      await queryClient.invalidateQueries({
        queryKey: ["business-appearance-profile", businessId],
      });
    },
    onError: (error: Error) =>
      toast.error(friendlyError(error, "aplicar as alterações de aparência")),
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
    <main className="min-h-full">
      <AppearanceEditor
        appearance={appearance}
        onChange={setAppearance}
        dirty={dirty}
        onUndo={() => {
          if (config.data) {
            setAppearance(config.data.appearance);
            setVisual(config.data.visual);
          }
          if (profile.data) setPageBackground(profile.data.brandBackground);
          setPendingLogoFile(null);
          setPendingBackgroundFile(null);
          setRemoveBackgroundImage(false);
        }}
        layoutKey={visual.layout_key}
        onLayoutKeyChange={(layout_key) => setVisual((current) => ({ ...current, layout_key }))}
        nicheId={visual.niche_id}
        onNicheIdChange={(niche_id) => setVisual((current) => ({ ...current, niche_id }))}
        onApplyPreset={(preset) => {
          setAppearance((current) => applyPanel1AppearancePreset(current, preset));
          setPageBackground(PANEL1_PRESET_DETAILS[preset].pageBackground);
        }}
        onSave={() => save.mutate()}
        saving={save.isPending}
        businessName={business?.name ?? ""}
        businessLogoUrl={pendingLogoUrl ?? profile.data?.logoUrl ?? null}
        businessAddress={business?.address ?? null}
        services={servicesQuery.data ?? []}
        pageBackground={pageBackground}
        onPageBackgroundChange={setPageBackground}
        onLogoFileSelected={(file) => setPendingLogoFile(file)}
        logoUploading={save.isPending}
        backgroundImageUrl={
          removeBackgroundImage
            ? null
            : (pendingBackgroundUrl ?? profile.data?.backgroundImageUrl ?? null)
        }
        onBackgroundImageFileSelected={(file) => {
          setRemoveBackgroundImage(false);
          setPendingBackgroundFile(file);
        }}
        onClearBackgroundImage={() => {
          setPendingBackgroundFile(null);
          setRemoveBackgroundImage(!!profile.data?.backgroundImagePath);
        }}
        backgroundImageUploading={save.isPending}
      />
      {save.isError && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível salvar a aparência. Tente novamente.
        </p>
      )}
    </main>
  );
}
