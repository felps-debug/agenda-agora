import type { ReactNode } from "react";
import { Store } from "lucide-react";

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
