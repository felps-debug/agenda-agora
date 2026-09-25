import { createFileRoute, redirect } from "@tanstack/react-router";

/** Compatibilidade para links antigos; o destino aplica a guarda Master no loader. */
export const Route = createFileRoute("/_authenticated/master")({
  beforeLoad: () => {
    throw redirect({ to: "/painel/master" });
  },
});
