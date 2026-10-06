import type { ReactNode } from "react";
import { LoaderCircle, Store } from "lucide-react";
import { useBusiness } from "@/lib/business";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1>{title}</h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-[0.9rem] leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

export function NoBusiness() {
  const { loading } = useBusiness();

  if (loading) {
    return (
      <div className="surface flex min-h-52 flex-col items-center justify-center gap-3 p-10 text-center">
        <LoaderCircle className="size-7 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Carregando estabelecimento...</p>
      </div>
    );
  }

  return (
    <div className="surface flex flex-col items-center p-10 text-center">
      <Store className="size-8 text-primary" />
      <h2 className="mt-4 text-lg font-bold">Painel aguardando configuração</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Este acesso do estabelecimento é fixo. O negócio e o link de agendamento são configurados
        exclusivamente pelo painel Master.
      </p>
    </div>
  );
}

export function EmptyList({ text }: { text: string }) {
  return <div className="surface p-10 text-center text-sm text-muted-foreground">{text}</div>;
}
