import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { requireMasterAccess } from "@/lib/master.functions";
import { listClientErrors } from "@/lib/error-log.functions";
import type { ClientErrorKind } from "@/lib/client-error-data";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/painel/erros")({
  loader: () => (typeof window === "undefined" ? undefined : requireMasterAccess()),
  component: ClientErrorsPage,
});

function ClientErrorsPage() {
  const [kind, setKind] = useState<ClientErrorKind | "">("");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const list = useServerFn(listClientErrors);
  const cursor = cursors.at(-1);
  const query = useQuery({
    queryKey: ["client-errors", kind, cursor],
    queryFn: () => list({ data: { kind: kind || undefined, cursor, limit: 30 } }),
  });
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold text-white">Erros de produção</h1>
      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Tipo de erro"
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as ClientErrorKind | "");
            setCursors([undefined]);
          }}
          className="rounded-lg border border-border bg-background p-2"
        >
          <option value="">Todos os tipos</option>
          <option value="ui_error">Interface</option>
          <option value="unhandled_rejection">Promise rejeitada</option>
          <option value="request_failed">Requisição ou imagem</option>
        </select>
        <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
          Atualizar
        </Button>
      </div>
      {query.isLoading && <p>Carregando erros…</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      {query.data?.items.length === 0 && <p>Nenhum erro registrado.</p>}
      <div className="space-y-3">
        {query.data?.items.map((error) => (
          <article
            key={error.id}
            data-qa-diagnostic
            className="rounded-xl border border-border p-4"
          >
            <p className="text-xs text-muted-foreground">
              {new Date(error.occurred_at).toLocaleString("pt-BR")} · {error.kind}
            </p>
            <h2 className="mt-2 break-words font-medium">{error.message}</h2>
            <p className="break-all text-sm text-muted-foreground">{error.source}</p>
            <details className="mt-2 text-xs">
              <summary>Detalhes</summary>
              <pre className="overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(error.detail, null, 2)}
              </pre>
            </details>
          </article>
        ))}
      </div>
      <div className="flex gap-3">
        <Button
          disabled={cursors.length <= 1 || query.isFetching}
          onClick={() => setCursors((previous) => previous.slice(0, -1))}
        >
          Anterior
        </Button>
        <Button
          disabled={!query.data?.cursor || query.isFetching}
          onClick={() => setCursors((previous) => [...previous, query.data!.cursor!])}
        >
          Próxima
        </Button>
      </div>
    </section>
  );
}
