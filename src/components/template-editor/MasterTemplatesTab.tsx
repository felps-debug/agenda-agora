import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Pencil } from "lucide-react";
import { listVisualOutreachTemplates } from "@/lib/outreach-templates.functions";
import type { OutreachDesign } from "@/lib/outreach-design";
import { Button } from "@/components/ui/button";
import { TemplateCanvas } from "./TemplateCanvas";

type VisualTemplate = { id: string; title: string; design: OutreachDesign };

export function MasterTemplatesTab() {
  const listFn = useServerFn(listVisualOutreachTemplates);
  const templates = useQuery({
    queryKey: ["visual-outreach-templates", "master"],
    queryFn: () => listFn({ data: {} }),
  });

  if (templates.isLoading) return <p role="status">Carregando templates...</p>;
  if (templates.isError) return <p role="alert">Não foi possível carregar as artes.</p>;
  if (!templates.data?.length)
    return <p className="text-sm text-muted-foreground">Nenhuma arte cadastrada.</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {templates.data.map((template: VisualTemplate) => (
        <article key={template.id} className="surface space-y-3 p-4">
          <h3 className="font-semibold">{template.title}</h3>
          <div className="overflow-hidden rounded-lg border border-border bg-muted">
            <TemplateCanvas
              design={template.design}
              className="mx-auto max-h-[340px] w-full object-contain"
            />
          </div>
          <Button asChild variant="secondary" className="w-full">
            <a href={`/editor-template/${template.id}`} target="_blank" rel="noopener">
              <Pencil className="size-4" /> Editar em nova aba <ExternalLink className="size-4" />
            </a>
          </Button>
        </article>
      ))}
    </div>
  );
}
