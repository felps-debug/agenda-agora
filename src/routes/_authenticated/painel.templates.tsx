import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, ExternalLink, Share2 } from "lucide-react";
import { useBusiness } from "@/lib/business";
import type { OutreachDesign } from "@/lib/outreach-design";
import {
  getOutreachBusinessSettings,
  listVisualOutreachTemplates,
  saveOutreachBusinessSettings,
} from "@/lib/outreach-templates.functions";
import { downloadOutreachPng, shareOutreachPng } from "@/components/template-editor/export";
import { TemplateCanvas } from "@/components/template-editor/TemplateCanvas";
import { PageHeader, NoBusiness } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/painel/templates")({
  head: () => ({
    meta: [
      { title: "Templates — Agenda Agora" },
      { name: "description", content: "Edite suas artes de divulgação." },
    ],
  }),
  component: TemplatesPage,
});

// As mensagens automáticas (confirmação/lembrete) moraram aqui antes; agora ficam
// em /painel/lembretes. Essa página só edita a arte usada, mas precisa continuar
// mandando o objeto completo pro save (a server function grava tudo de uma vez).
type Settings = {
  selectedTemplateIds: string[];
  confirmationTemplate: string;
  paymentConfirmationTemplate: string;
  reminderTemplate: string;
  reminderHoursBefore: number;
};
type VisualTemplate = {
  id: string;
  title: string;
  design: OutreachDesign;
  isDefault: boolean;
  isCustomized: boolean;
};

function TemplatesPage() {
  const { businessId } = useBusiness();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listVisualOutreachTemplates);
  const getSettingsFn = useServerFn(getOutreachBusinessSettings);
  const saveSettingsFn = useServerFn(saveOutreachBusinessSettings);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const templates = useQuery({
    queryKey: ["visual-outreach-templates", businessId],
    enabled: !!businessId,
    queryFn: () => listFn({ data: { businessId: businessId! } }),
  });
  const settings = useQuery({
    queryKey: ["outreach-business-settings", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const value = await getSettingsFn({ data: { businessId: businessId! } });
      return {
        selectedTemplateIds: value.selectedTemplateIds,
        confirmationTemplate: value.confirmationTemplate,
        paymentConfirmationTemplate: value.paymentConfirmationTemplate,
        reminderTemplate: value.reminderTemplate,
        reminderHoursBefore: value.reminderHoursBefore,
      } satisfies Settings;
    },
  });

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (value: Settings) =>
      saveSettingsFn({ data: { businessId: businessId!, ...value } }),
    onSuccess: async () => {
      toast.success("Configurações salvas.");
      await queryClient.invalidateQueries({ queryKey: ["outreach-business-settings", businessId] });
    },
    onError: () => toast.error("Não foi possível salvar as configurações. Tente novamente."),
  });

  if (!businessId) return <NoBusiness />;
  if (!draft && settings.isLoading) return <p role="status">Carregando templates...</p>;
  if (settings.isError || templates.isError) {
    return (
      <p role="alert">
        Não foi possível carregar os templates. Atualize a página e tente novamente.
      </p>
    );
  }
  if (!draft) return <p role="status">Carregando configurações...</p>;

  const toggleTemplate = (templateId: string, checked: boolean) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            selectedTemplateIds: checked
              ? [...current.selectedTemplateIds, templateId]
              : current.selectedTemplateIds.filter((id) => id !== templateId),
          }
        : current,
    );
  };

  const share = async (id: string, title: string, design: OutreachDesign) => {
    setSharingId(id);
    try {
      const result = await shareOutreachPng(
        design,
        `${title.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}.png`,
      );
      if (result === "downloaded") {
        toast.success("Não deu pra abrir o compartilhamento, mas a arte foi baixada.");
      }
    } catch {
      toast.error("Não foi possível compartilhar esta arte.");
    } finally {
      setSharingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Templates de divulgação"
        subtitle="Personalize as artes que o seu negócio usa pra divulgar."
      />

      <section aria-labelledby="outreach-designs-title" className="space-y-4">
        <div>
          <h2 id="outreach-designs-title" className="text-lg font-bold">
            Artes de divulgação
          </h2>
          <p className="text-sm text-muted-foreground">
            Escolha as artes que quer usar. Cada edição fica salva na sua conta.
          </p>
        </div>
        {templates.isLoading ? (
          <p role="status">Carregando artes...</p>
        ) : !templates.data?.length ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma arte disponível no momento.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {templates.data.map((template: VisualTemplate) => (
              <article key={template.id} className="surface flex flex-col gap-3 p-4">
                <h3 className="font-semibold">{template.title}</h3>
                <div className="overflow-hidden rounded-lg border border-border bg-muted">
                  <TemplateCanvas
                    design={template.design}
                    className="mx-auto max-h-[360px] w-full object-contain"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.selectedTemplateIds.includes(template.id)}
                    onChange={(event) => toggleTemplate(template.id, event.target.checked)}
                  />
                  Usar este template
                </label>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button asChild type="button" variant="secondary" size="sm">
                    <a href={`/editor-template/${template.id}`} target="_blank" rel="noopener">
                      <ExternalLink className="size-4" />
                      Editar
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      void downloadOutreachPng(template.design, `${template.title}.png`).then(
                        () => toast.success("Arte baixada."),
                        () => toast.error("Não foi possível baixar a arte."),
                      )
                    }
                  >
                    <Download className="size-4" />
                    Baixar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={sharingId === template.id}
                    onClick={() => void share(template.id, template.title, template.design)}
                  >
                    <Share2 className="size-4" />
                    {sharingId === template.id ? "Compartilhando..." : "Compartilhar"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
        {!!templates.data?.length && (
          <Button type="button" disabled={save.isPending} onClick={() => save.mutate(draft)}>
            {save.isPending ? "Salvando..." : "Salvar seleção"}
          </Button>
        )}
      </section>
    </div>
  );
}
