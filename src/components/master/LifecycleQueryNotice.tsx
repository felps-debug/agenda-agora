import { lifecycleQueryState } from "@/lib/lifecycle-query-state";

export function LifecycleQueryNotice({
  isLoading,
  isError,
  isFetching,
  hasData,
  onRetry,
}: {
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  hasData: boolean;
  onRetry: () => void;
}) {
  const state = lifecycleQueryState({ isLoading, isError, hasData });
  if (state === "loading") {
    return (
      <p className="mt-4 text-sm text-muted-foreground" role="status">
        Carregando dados das contas…
      </p>
    );
  }
  if (state === "error") {
    return (
      <div
        className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200"
        role="alert"
      >
        <span>
          Não foi possível carregar os dados de lifecycle. Os indicadores podem estar
          desatualizados.
        </span>
        <button
          type="button"
          onClick={onRetry}
          disabled={isFetching}
          className="underline disabled:opacity-50"
        >
          {isFetching ? "Atualizando…" : "Tentar novamente"}
        </button>
      </div>
    );
  }
  return null;
}
