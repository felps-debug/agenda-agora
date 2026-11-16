export function ServiceCategoriesQueryNotice({
  isLoading,
  isError,
  isFetching,
  onRetry,
}: {
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <p className="p-4 text-sm text-muted-foreground" role="status">
        Carregando categorias…
      </p>
    );
  }
  if (isError) {
    return (
      <div
        className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200"
        role="alert"
      >
        <span>Não foi possível carregar as categorias. Tente novamente.</span>
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
