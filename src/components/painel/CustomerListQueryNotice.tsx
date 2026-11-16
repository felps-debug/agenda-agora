export function CustomerListQueryNotice({
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
      <p
        className="mb-4 rounded-xl border border-muted/30 p-4 text-center text-sm text-muted-foreground"
        role="status"
      >
        Carregando clientes…
      </p>
    );
  }
  if (isError) {
    return (
      <div
        className="mb-4 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-destructive/40 p-4 text-sm"
        role="alert"
      >
        <span>Não foi possível carregar clientes e visitas.</span>
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
