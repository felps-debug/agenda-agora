import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { SoonPage } from "@/components/painel/Soon";

export const Route = createFileRoute("/_authenticated/painel/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — Agenda Agora" },
      { name: "description", content: "Gerencie os produtos e o catálogo do negócio." },
    ],
  }),
  component: ProdutosPage,
});

function ProdutosPage() {
  return (
    <SoonPage
      title="Produtos"
      subtitle="Organize os produtos e o catálogo do seu negócio."
      icon={Package}
      bullets={["Cadastro de produtos", "Preço e disponibilidade", "Catálogo para o cliente"]}
    />
  );
}
