import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, MessageSquareText } from "lucide-react";
import { useBusiness } from "@/lib/business";
import { listOutreachTemplatesForBusiness } from "@/lib/outreach-templates.functions";
import { PageHeader, NoBusiness, EmptyList } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";

const usageTypeLabel: Record<string, string> = {
  story: "Story",
  whatsapp: "WhatsApp",
  outro: "Outro",
};

export const Route = createFileRoute("/_authenticated/painel/templates")({
  head: () => ({
    meta: [
      { title: "Templates — Agenda Agora" },
      {
        name: "description",
        content: "Textos prontos de divulgação personalizados com os dados do seu negócio.",
      },
      { property: "og:title", content: "Templates — Agenda Agora" },
      {
        property: "og:description",
        content: "Textos prontos de divulgação personalizados com os dados do seu negócio.",
      },
    ],
  }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const { businessId } = useBusiness();
  const listFn = useServerFn(listOutreachTemplatesForBusiness);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const templates = useQuery({
    queryKey: ["outreach-templates", businessId],
    enabled: !!businessId,
    queryFn: () => listFn({ data: { businessId: businessId! } }),
  });

  if (!businessId) return <NoBusiness />;

  const copyText = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Texto copiado!");
  };

  const rows = templates.data ?? [];

  return (
    <div>
      <PageHeader
        title="Templates de Divulgação"
        subtitle="Textos prontos pra postar no story, mandar no WhatsApp ou usar como quiser — já com os dados do seu negócio preenchidos."
      />

      {templates.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !rows.length ? (
        <EmptyList text="Nenhum template disponível no momento." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((template) => (
            <div key={template.id} className="surface flex flex-col gap-3 p-5">
              <div className="flex items-center gap-2">
                <MessageSquareText className="size-4 text-primary" />
                <h3 className="font-bold">{template.title}</h3>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {usageTypeLabel[template.usage_type] ?? template.usage_type}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {template.personalizedBody}
              </p>
              <Button
                variant="secondary"
                className="mt-auto w-fit"
                onClick={() => copyText(template.id, template.personalizedBody)}
              >
                {copiedId === template.id ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                Copiar texto
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
