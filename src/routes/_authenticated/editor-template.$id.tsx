import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EditorPanel } from "@/components/template-editor/EditorPanel";
import { getMasterStatus } from "@/lib/admin.functions";
import { useBusiness } from "@/lib/business";
import {
  listVisualOutreachTemplates,
  saveBusinessOutreachOverride,
  saveOutreachTemplateDesign,
} from "@/lib/outreach-templates.functions";
import type { OutreachDesign } from "@/lib/outreach-design";

type VisualTemplate = { id: string; title: string; design: OutreachDesign };

export const Route = createFileRoute("/_authenticated/editor-template/$id")({
  component: OutreachTemplateEditorPage,
});

function OutreachTemplateEditorPage() {
  const { id } = Route.useParams();
  const { businessId } = useBusiness();
  const queryClient = useQueryClient();
  const statusFn = useServerFn(getMasterStatus);
  const listFn = useServerFn(listVisualOutreachTemplates);
  const saveMasterFn = useServerFn(saveOutreachTemplateDesign);
  const saveBusinessFn = useServerFn(saveBusinessOutreachOverride);
  const [designs, setDesigns] = useState<Record<string, OutreachDesign>>({});
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number | null>(null);

  const status = useQuery({ queryKey: ["master-status"], queryFn: () => statusFn() });
  const isMaster = status.data?.isMaster === true;
  const templates = useQuery({
    queryKey: ["visual-outreach-templates", isMaster ? "master" : businessId],
    enabled: status.isSuccess && (isMaster || !!businessId),
    queryFn: () => listFn({ data: isMaster ? {} : { businessId: businessId! } }),
  });

  useEffect(() => {
    if (!templates.data) return;
    setDesigns(
      Object.fromEntries(templates.data.map((item: VisualTemplate) => [item.id, item.design])),
    );
  }, [templates.data]);

  const template = templates.data?.find((item: VisualTemplate) => item.id === id);
  const design = designs[id] ?? template?.design;
  const dirty = useMemo(() => {
    if (!templates.data) return false;
    return templates.data.some((item: VisualTemplate) => {
      const draft = designs[item.id];
      return draft && JSON.stringify(draft) !== JSON.stringify(item.design);
    });
  }, [designs, templates.data]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = useMutation({
    mutationFn: async () => {
      if (!template || !design) throw new Error("A arte não foi encontrada.");
      if (isMaster) return saveMasterFn({ data: { templateId: id, design } });
      if (!businessId) throw new Error("Nenhum negócio foi selecionado.");
      return saveBusinessFn({ data: { businessId, templateId: id, design } });
    },
    onSuccess: async () => {
      toast.success("Arte salva.");
      await queryClient.invalidateQueries({ queryKey: ["visual-outreach-templates"] });
    },
    onError: () => toast.error("Não foi possível salvar a arte. Tente novamente."),
  });

  if (status.isLoading || templates.isLoading)
    return (
      <p role="status" className="p-6">
        Carregando editor...
      </p>
    );
  if (status.isError || templates.isError)
    return (
      <p role="alert" className="p-6">
        Não foi possível carregar o editor. Atualize a página e tente novamente.
      </p>
    );
  if (!isMaster && !businessId)
    return (
      <p role="alert" className="p-6">
        Selecione um negócio para editar as artes.
      </p>
    );
  if (!template || !design)
    return (
      <p role="alert" className="p-6">
        Esta arte não foi encontrada.
      </p>
    );

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" aria-label="Voltar para templates">
              <Link
                to="/painel/templates"
                onClick={(event) => {
                  if (
                    dirty &&
                    !window.confirm("Você tem alterações não salvas. Sair mesmo assim?")
                  ) {
                    event.preventDefault();
                  }
                }}
              >
                <ArrowLeft />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">Editar arte: {template.title}</h1>
              <p className="text-sm text-muted-foreground">
                As alterações só são gravadas ao salvar.
              </p>
            </div>
          </div>
          <Button type="button" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            <Save />
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </header>
      <div className="mx-auto max-w-[1600px] space-y-5 p-4 lg:p-6">
        {save.isError && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
          >
            Não foi possível salvar a arte. Tente novamente.
          </p>
        )}
        <EditorPanel
          design={design}
          selectedLayerIndex={selectedLayerIndex}
          onSelect={setSelectedLayerIndex}
          onChange={(next) => setDesigns((current) => ({ ...current, [id]: next }))}
        />
      </div>
    </main>
  );
}
