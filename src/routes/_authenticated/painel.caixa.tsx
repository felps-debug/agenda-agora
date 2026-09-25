import { createFileRoute } from "@tanstack/react-router";
import { Calculator } from "lucide-react";
import { SoonPage } from "@/components/painel/Soon";

export const Route = createFileRoute("/_authenticated/painel/caixa")({
  head: () => ({
    meta: [
      { title: "Caixa — Agenda Agora" },
      { name: "description", content: "Abertura, fechamento e movimentações do caixa diário." },
      { property: "og:title", content: "Caixa — Agenda Agora" },
      { property: "og:description", content: "Movimentações do caixa diário." },
    ],
  }),
  component: () => (
    <SoonPage
      title="Caixa"
      subtitle="Controle as entradas e saídas do dia."
      icon={Calculator}
      bullets={[
        "Abertura e fechamento de caixa",
        "Sangrias e suprimentos",
        "Resumo por forma de pagamento",
      ]}
    />
  ),
});
