import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Instagram, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  LOGO_ACCEPT,
  LOGO_BUCKET,
  getLogoUrl,
  logoStorageErrorMessage,
  validateLogoFile,
} from "@/lib/logo";
import { getPanel1Config, savePanel1Config } from "@/lib/panel1-config.functions";
import {
  DEFAULT_PANEL1_APPEARANCE,
  type Panel1Appearance as Appearance,
} from "@/lib/panel1-config";

export function AppearanceSettings({ businessId }: { businessId: string }) {
  const queryClient = useQueryClient();
  const getConfigFn = useServerFn(getPanel1Config);
  const saveConfigFn = useServerFn(savePanel1Config);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [background, setBackground] = useState("#050607");
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_PANEL1_APPEARANCE);

  const { data } = useQuery({
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
      const logoPath = business?.logo_url ?? null;
      return {
        logoPath,
        logoUrl: await getLogoUrl(logoPath, businessId),
        brand_background: business?.brand_background ?? null,
        appearance: config.appearance,
      };
    },
  });

  useEffect(() => {
    if (!data) return;
    hydratedRef.current = false;
    setBackground(data.brand_background ?? "#050607");
    setAppearance(data.appearance);
    window.requestAnimationFrame(() => {
      hydratedRef.current = true;
    });
  }, [data]);

  const persistAppearance = useMutation({
    mutationFn: async ({
      nextBackground,
      nextAppearance,
    }: {
      nextBackground: string;
      nextAppearance: Appearance;
    }) => {
      const { data, error } = await supabase
        .from("businesses")
        .update({ brand_background: nextBackground })
        .eq("id", businessId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("O negócio não foi encontrado para atualizar.");
      await saveConfigFn({ data: { businessId, patch: { appearance: nextAppearance } } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    saveTimerRef.current = window.setTimeout(() => {
      persistAppearance.mutate({
        nextBackground: background,
        nextAppearance: appearance,
      });
    }, 450);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appearance, background]);

  const upload = useMutation({
    mutationFn: async ({ file, extension }: { file: File; extension: string }) => {
      const uploadPath = `${businessId}/logo-${crypto.randomUUID()}.${extension}`;
      let uploadError;
      try {
        const result = await supabase.storage
          .from(LOGO_BUCKET)
          .upload(uploadPath, file, { upsert: false, contentType: file.type });
        uploadError = result.error;
      } catch {
        throw new Error("Não foi possível enviar o logotipo. Tente novamente.");
      }
      if (uploadError) throw new Error(logoStorageErrorMessage(uploadError));

      const { data: updatedBusiness, error: dbError } = await supabase
        .from("businesses")
        .update({ logo_url: uploadPath })
        .eq("id", businessId)
        .select("id")
        .maybeSingle();
      if (dbError || !updatedBusiness) {
        throw new Error("A imagem foi enviada, mas não foi possível salvar o logotipo.");
      }

      if (data?.logoPath) {
        try {
          await supabase.storage.from(LOGO_BUCKET).remove([data.logoPath]);
        } catch {
          // A limpeza da imagem antiga não altera a atualização já concluída.
        }
      }
    },
    onSuccess: () => {
      toast.success("Logotipo atualizado");
      void queryClient.invalidateQueries({ queryKey: ["panel1-appearance", businessId] });
    },
    onError: (error: Error) => {
      setLogoError(error.message);
      toast.error(error.message);
    },
    onSettled: () => setBusy(false),
  });

  const setColor = (key: keyof Appearance, value: string) => {
    setAppearance((current) => ({ ...current, [key]: value }));
  };

  const previewServices = [
    { price: "R$ 25,00 - 30min", description: "Exemplo de descrição" },
    { price: "R$ 45,00 - 40min", description: "Exemplo de descrição" },
    { price: "R$ 80,00 - 60min", description: "" },
  ];

  return (
    <div className="mx-auto w-full max-w-[650px] bg-[#4a4a4a] px-4 pb-9 pt-7 sm:px-8">
      <input
        ref={inputRef}
        type="file"
        accept={LOGO_ACCEPT}
        className="hidden"
        aria-label="Selecionar logotipo"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file || busy) return;

          setLogoError(null);
          const validation = validateLogoFile(file);
          if (!validation.valid) {
            setLogoError(validation.message);
            toast.error(validation.message);
            return;
          }

          setBusy(true);
          upload.mutate({ file, extension: validation.extension });
        }}
      />

      <section
        className="mx-auto w-full max-w-[448px] rounded-[12px] px-5 pb-6 pt-8"
        style={{
          backgroundColor: background,
          color: appearance.page_text,
        }}
      >
        <button
          type="button"
          onClick={() => !busy && inputRef.current?.click()}
          disabled={busy}
          title="Clique para trocar o logotipo"
          aria-label="Trocar logotipo"
          aria-busy={busy}
          aria-describedby={logoError ? "logo-upload-help logo-upload-error" : "logo-upload-help"}
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
        <p id="logo-upload-help" className="mt-2 text-center text-xs opacity-80">
          PNG, JPEG ou WebP, até 5 MB.
        </p>
        {logoError && (
          <p
            id="logo-upload-error"
            role="alert"
            className="mt-2 rounded bg-red-950 px-3 py-2 text-center text-sm text-red-50"
          >
            {logoError}
          </p>
        )}

        <h3 className="mt-5 text-center text-[28px] font-medium leading-none">SERVIÇOS</h3>

        <div className="mx-auto mt-6 w-full max-w-[306px] space-y-6">
          {previewServices.map((service, index) => (
            <div
              key={index}
              className="flex min-h-[112px] flex-col items-center justify-center rounded-[8px] border-2 px-4 py-3 text-center"
              style={{
                backgroundColor: appearance.service_background,
                color: appearance.service_text,
                borderColor: appearance.service_border,
              }}
            >
              <p className="text-[16px] font-medium leading-5">Serviço de exemplo</p>
              <p className="mt-7 text-[16px] font-semibold leading-5">{service.price}</p>
              {service.description ? (
                <p className="mt-1 text-[16px] font-medium leading-5">{service.description}</p>
              ) : null}
            </div>
          ))}
        </div>

        <div
          className="mt-6 flex items-center justify-center gap-2.5"
          style={{ color: appearance.page_text }}
        >
          <MapPin className="size-8" strokeWidth={2.1} />
          <Instagram className="size-8" strokeWidth={2.1} />
        </div>
      </section>

      <div className="mx-auto mt-8 flex w-full max-w-[448px] justify-center">
        <div className="rounded-[12px] bg-[#2c2c2c] px-4 py-3 text-[16px] font-bold text-white shadow-[0_4px_12px_rgba(0,0,0,0.20)]">
          Configurações avançadas
        </div>
      </div>

      <section className="mx-auto mt-5 grid w-full max-w-[430px] grid-cols-2 gap-x-10 gap-y-3 sm:gap-x-16">
        <ColorDotControl label="Cor de fundo" value={background} onChange={setBackground} />
        <ColorDotControl
          label="Texto da página"
          value={appearance.page_text}
          onChange={(value) => setColor("page_text", value)}
        />

        <ColorDotControl
          label="Borda hover serviço"
          value={appearance.service_hover_border}
          onChange={(value) => setColor("service_hover_border", value)}
        />
        <ColorDotControl
          label="Borda serviço"
          value={appearance.service_border}
          onChange={(value) => setColor("service_border", value)}
        />

        <ColorDotControl
          label="Texto hover serviço"
          value={appearance.service_hover_text}
          onChange={(value) => setColor("service_hover_text", value)}
        />
        <ColorDotControl
          label="Texto serviço"
          value={appearance.service_text}
          onChange={(value) => setColor("service_text", value)}
        />

        <ColorDotControl
          label="Texto hover modal"
          value={appearance.modal_hover_text}
          onChange={(value) => setColor("modal_hover_text", value)}
        />
        <ColorDotControl
          label="Hover serviço"
          value={appearance.service_hover_background}
          onChange={(value) => setColor("service_hover_background", value)}
        />

        <ColorDotControl
          label="Texto ativo modal"
          value={appearance.modal_active_text}
          onChange={(value) => setColor("modal_active_text", value)}
        />
        <ColorDotControl
          label="Borda modal"
          value={appearance.modal_border}
          onChange={(value) => setColor("modal_border", value)}
        />

        <ColorDotControl
          label="Borda agenda"
          value={appearance.agenda_border}
          onChange={(value) => setColor("agenda_border", value)}
        />
        <ColorDotControl
          label="Texto modal"
          value={appearance.modal_text}
          onChange={(value) => setColor("modal_text", value)}
        />

        <ColorDotControl
          label="Texto agenda"
          value={appearance.agenda_text}
          onChange={(value) => setColor("agenda_text", value)}
        />
        <ColorDotControl
          label="Background agenda"
          value={appearance.agenda_background}
          onChange={(value) => setColor("agenda_background", value)}
        />

        <ColorDotControl
          label="Background hover modal"
          value={appearance.modal_hover_background}
          onChange={(value) => setColor("modal_hover_background", value)}
        />
        <ColorDotControl
          label="Background ativo modal"
          value={appearance.modal_active_background}
          onChange={(value) => setColor("modal_active_background", value)}
        />
      </section>
    </div>
  );
}

function ColorDotControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 cursor-pointer flex-col items-center text-center">
      <span className="min-h-[40px] text-[15px] font-bold leading-[19px] text-white">{label}</span>
      <span
        className="relative mt-1 block size-[52px] overflow-hidden rounded-full border border-black/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </span>
    </label>
  );
}
