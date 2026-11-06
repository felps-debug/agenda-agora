import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * US5 — A rota "Carteira — Performance" foi renomeada para "Ag Pay — Performance"
 * (`/painel/agpay-performance`). Este stub mantém o caminho antigo funcionando
 * (links salvos/favoritos) redirecionando para o novo.
 */
export const Route = createFileRoute("/_authenticated/painel/carteira-desempenho")({
  beforeLoad: () => {
    throw redirect({ to: "/painel/agpay-performance" });
  },
});
