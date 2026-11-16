import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { listVisualOutreachTemplates } from "@/lib/outreach-templates.functions";
import type { OutreachDesign } from "@/lib/outreach-design";
import { TemplateCanvas } from "./TemplateCanvas";

type VisualTemplate = { id: string; title: string; design: OutreachDesign };

export function BusinessTemplateCard({ template }: { template: VisualTemplate }) {
  return (
    <article className="rounded-2xl border border-[#d9cbbb] bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-[#3f2d1d]">{template.title}</h3>
      <div className="mt-3 overflow-hidden rounded-lg border border-[#e9e0d6] bg-[#f6f1ea]">
        <TemplateCanvas
          design={template.design}
          className="mx-auto max-h-[340px] w-full object-contain"
        />
      </div>
      <a
        href={"/editor-template/" + template.id}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#3f2d1d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5a402b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6a45] focus-visible:ring-offset-2"
      >
        <Pencil className="size-4" />
        Editar arte
      </a>
    </article>
  );
}

export function BusinessTemplatesTab({ businessId }: { businessId: string }) {
  const listFn = useServerFn(listVisualOutreachTemplates);
  const templates = useQuery({
    queryKey: ["visual-outreach-templates", businessId],
    queryFn: () => listFn({ data: { businessId } }),
  });

  return (
    <section
      aria-labelledby="business-visual-templates-title"
      className="rounded-[2rem] border border-[#e4d9cc] bg-[#fffaf4] p-5 sm:p-7"
    >
      <div className="mb-5">
        <h2
          id="business-visual-templates-title"
          className="text-xl font-bold text-[#3f2d1d] sm:text-2xl"
        >
          Suas artes para editar
        </h2>
        <p className="mt-1 text-sm text-[#766453]">
          Escolha uma arte para abrir o preview e os controles do editor visual.
        </p>
      </div>
      {templates.isPending ? (
        <p role="status" className="py-8 text-center text-sm text-[#766453]">
          Carregando artes...
        </p>
      ) : templates.isError ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-900"
        >
          <p>Nao foi possivel carregar suas artes.</p>
          <button
            type="button"
            onClick={() => void templates.refetch()}
            disabled={templates.isFetching}
            className="min-h-11 rounded-lg border border-red-300 px-4 py-2 font-semibold disabled:opacity-50"
          >
            {templates.isFetching ? "Atualizando..." : "Tentar novamente"}
          </button>
        </div>
      ) : templates.data.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#766453]">
          Nenhuma arte visual esta disponivel para edicao.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.data.map((template: VisualTemplate) => (
            <BusinessTemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </section>
  );
}
