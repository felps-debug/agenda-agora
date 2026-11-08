import { type ReactNode } from "react";
import { useAvisoDismissal } from "@/hooks/useAvisoDismissal";
import { BellRing, TriangleAlert } from "lucide-react";
import type { BillingStage } from "@/lib/billing-cycle";
import { AvisoPop } from "@/components/painel/AvisoPop";
import { TONE_GREEN, TONE_RED } from "@/components/master/PlatformOverview";

type AvisoCobrancaProps = {
  stage: BillingStage;
  businessName: string;
  businessId?: string;
  onRenovar: () => void;
};

/**
 * Avisos de cobrança da assinatura mensal (ciclo de 5 estágios):
 * - 1 dia antes: lembrete verde junto ao ícone de notificações;
 * - no dia do vencimento: popup verde "fatura venceu hoje";
 * - 1 dia após: popup vermelho "ATENÇÃO!";
 * - 2º e 3º dias após: modal escuro "Urgente!" (fechável, só aviso);
 * - 4º dia: o painel é travado na tela de assinaturas (fora deste componente).
 * A dispensa vale por negócio, estágio e dia local, inclusive após F5.
 */
export function AvisoCobranca({ stage, businessName, businessId, onRenovar }: AvisoCobrancaProps) {
  const { visible, dismiss: fechar } = useAvisoDismissal(
    "cobranca",
    businessId ? `${businessId}:${stage}` : stage,
  );
  if (!visible) return null;
  const renovar = () => {
    onRenovar();
    fechar();
  };

  if (stage === "amanha") {
    return (
      <TopAviso tom="verde" fechar={fechar}>
        <p>
          Passando pra lembrar que sua fatura vai vencer <span className="font-bold">amanhã!</span>
        </p>
        <p className="mt-1">
          <button type="button" onClick={renovar} className="aa-link">
            Clique aqui
          </button>{" "}
          para renovar o pagamento.
        </p>
      </TopAviso>
    );
  }

  if (stage === "venceu_hoje") {
    return (
      <TopAviso tom="verde" fechar={fechar} title={`Olá, ${businessName}!`}>
        <p>
          Passando pra lembrar que sua fatura venceu <span className="font-bold">hoje!</span>
        </p>
        <p className="mt-1">
          <button type="button" onClick={renovar} className="aa-link">
            Clique aqui
          </button>{" "}
          para renovar o pagamento.
        </p>
      </TopAviso>
    );
  }

  if (stage === "atrasado") {
    return (
      <TopAviso tom="vermelho" fechar={fechar} title="Atenção!">
        <p>Sua fatura do sistema venceu.</p>
        <p className="mt-1">
          <button type="button" onClick={renovar} className="aa-link">
            Clique aqui
          </button>{" "}
          para renova-la e evite bloqueios!
        </p>
      </TopAviso>
    );
  }

  if (stage === "urgente") {
    return (
      <div
        role="alertdialog"
        aria-modal="false"
        aria-label="Pagamento pendente"
        className="fixed inset-0 z-[85] grid place-items-center bg-black/60 p-4"
      >
        <div className="smodal-card" id="expired-modal-card">
          <button type="button" className="smodal-x" onClick={fechar} aria-label="Fechar">
            ×
          </button>
          <div className="smodal-badge sm-badge-amber">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2>Pagamento pendente</h2>
          <p>
            Ainda <b>não identificamos</b> seu pagamento. O funcionamento do sistema poderá parar a
            qualquer momento. Renove agora pra manter sua agenda e seus lembretes no automático.
          </p>
          <button type="button" className="smodal-cta sm-cta-amber" onClick={renovar}>
            Renovar meu plano
          </button>
          <div className="smodal-sub">Pagamento via PIX · Liberação imediata</div>
        </div>
      </div>
    );
  }

  return null;
}

/** Cartão flutuante junto ao ícone de notificações (estágios 1 a 3) —
 * usa a identidade FIXA de pop-up (AvisoPop). */
function TopAviso({
  tom,
  fechar,
  title,
  children,
}: {
  tom: "verde" | "vermelho";
  fechar: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <AvisoPop
      extraClass="aa-aviso-faturamento"
      tone={tom === "verde" ? TONE_GREEN : TONE_RED}
      icon={
        tom === "verde" ? (
          <BellRing className="size-[1.05rem]" strokeWidth={1.8} aria-hidden="true" />
        ) : (
          <TriangleAlert className="size-[1.05rem]" strokeWidth={1.8} aria-hidden="true" />
        )
      }
      title={title}
      onClose={fechar}
    >
      {children}
    </AvisoPop>
  );
}
