import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, Download, MessageSquareText, Share2 } from "lucide-react";
import { useBusiness } from "@/lib/business";
import { listOutreachTemplatesForBusiness } from "@/lib/outreach-templates.functions";
import { PageHeader, NoBusiness, EmptyList } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { outreachArts } from "@/lib/outreach-art";

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
  const [availableArts, setAvailableArts] = useState<string[]>([]);
  const [unavailableArts, setUnavailableArts] = useState<string[]>([]);
  const [sharingArtId, setSharingArtId] = useState<string | null>(null);
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});

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

  const shareOrDownloadArt = async (art: (typeof outreachArts)[number]) => {
    const url = new URL(art.file, window.location.origin);
    try {
      if (navigator.share && navigator.canShare) {
        setSharingArtId(art.id);
        const response = await fetch(url);
        if (!response.ok) throw new Error("A arte não está disponível.");
        const file = new File([await response.blob()], art.file.split("/").at(-1)!, {
          type: art.file.endsWith(".png") ? "image/png" : "image/webp",
        });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: art.name, text: art.description });
          return;
        }
      }
      const link = document.createElement("a");
      link.href = url.href;
      link.download = art.file.split("/").at(-1)!;
      document.body.append(link);
      link.click();
      link.remove();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const link = document.createElement("a");
      link.href = url.href;
      link.download = art.file.split("/").at(-1)!;
      document.body.append(link);
      link.click();
      link.remove();
      toast.message("Compartilhamento indisponível; iniciando o download.");
    } finally {
      setSharingArtId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Templates de Divulgação"
        subtitle="Textos prontos pra postar no story, mandar no WhatsApp ou usar como quiser — já com os dados do seu negócio preenchidos."
      />

      <section className="mb-6" aria-labelledby="outreach-arts-heading">
        <h2 id="outreach-arts-heading" tabIndex={-1} className="mb-3 text-lg font-bold">
          Artes de divulgação
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {outreachArts.map((art) => (
            <article key={art.id} className="surface flex flex-col gap-3 p-5">
              <h3 className="font-bold">{art.name}</h3>
              <p className="text-sm text-muted-foreground">{art.description}</p>
              {!unavailableArts.includes(art.id) ? (
                <img
                  src={art.file}
                  alt={art.description}
                  className="max-h-[28rem] w-full rounded-lg object-contain"
                  onLoad={() => {
                    setUnavailableArts((current) => current.filter((id) => id !== art.id));
                    setAvailableArts((current) =>
                      current.includes(art.id) ? current : [...current, art.id],
                    );
                  }}
                  onError={() => {
                    setAvailableArts((current) => current.filter((id) => id !== art.id));
                    setUnavailableArts((current) =>
                      current.includes(art.id) ? current : [...current, art.id],
                    );
                  }}
                />
              ) : (
                <p role="status" className="text-sm text-muted-foreground">
                  Não foi possível carregar esta arte.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!availableArts.includes(art.id)}
                  onClick={() => void shareOrDownloadArt(art)}
                >
                  <Download className="size-4" />
                  Baixar arte
                </Button>
                {typeof navigator !== "undefined" && !!navigator.share && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!availableArts.includes(art.id) || sharingArtId === art.id}
                    onClick={() => void shareOrDownloadArt(art)}
                  >
                    <Share2 className="size-4" />
                    {sharingArtId === art.id ? "Compartilhando..." : "Compartilhar"}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {templates.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !rows.length ? (
        <EmptyList text="Nenhum texto de divulgação disponível no momento." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((template) => {
            const message = messageDrafts[template.id] ?? template.personalizedBody;
            return (
              <div key={template.id} className="surface flex flex-col gap-3 p-5">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="size-4 text-primary" />
                  <h3 className="font-bold">{template.title}</h3>
                  <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {usageTypeLabel[template.usage_type] ?? template.usage_type}
                  </span>
                </div>
                <Textarea
                  aria-label={`Texto de ${template.title}`}
                  value={message}
                  onChange={(event) =>
                    setMessageDrafts((current) => ({
                      ...current,
                      [template.id]: event.target.value,
                    }))
                  }
                  rows={8}
                />
                <Button
                  variant="secondary"
                  className="mt-auto w-fit"
                  onClick={() => copyText(template.id, message)}
                >
                  {copiedId === template.id ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  Copiar texto
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
