import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft } from "lucide-react";
import type { Panel1Appearance } from "@/lib/panel1-config";

const CONSENT_KEY = "aa-cookie-consent-v1";

/** Texto oficial de Termos de Uso e Política de Privacidade do Agenda Agora. */
const PRIVACY_TERMS = [
  "O Agenda Agora é uma plataforma digital de agendamentos e gestão para barbearias, salões de beleza, profissionais de estética e prestadores de serviços em geral.",
  "Nosso objetivo é facilitar a organização de horários, clientes, serviços e pagamentos, oferecendo ferramentas para melhorar a gestão dos estabelecimentos.",
  "Ao utilizar o Agenda Agora, o usuário concorda com estes Termos de Uso e com nossa Política de Privacidade.",
  "O usuário é responsável por fornecer informações verdadeiras, manter seus dados atualizados e proteger suas credenciais de acesso.",
  "O Agenda Agora fornece a tecnologia para gerenciamento de agendamentos, mas não realiza os serviços oferecidos pelos estabelecimentos.",
  "Cada profissional ou estabelecimento é responsável pelos horários, preços, atendimentos, cancelamentos e qualidade dos serviços prestados.",
  "O AG Pay disponibiliza recursos para facilitar a cobrança de sinais e pagamentos relacionados aos agendamentos.",
  "As condições de cobrança, cancelamento e reembolso deverão ser respeitadas pelo estabelecimento e informadas ao cliente, conforme a legislação aplicável.",
  "Os pagamentos devem ser realizados pelos meios disponibilizados oficialmente na plataforma.",
  "É proibido utilizar a plataforma para atividades ilegais, fraudes, compartilhamento indevido de dados ou qualquer ação que comprometa seu funcionamento.",
  "O descumprimento destas condições poderá resultar na suspensão ou encerramento da conta.",
  "Os dados pessoais são tratados conforme a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018), sendo utilizados para funcionamento da plataforma, agendamentos, pagamentos, segurança e atendimento.",
  "Mais informações estão disponíveis em nossa Política de Privacidade.",
  "O Agenda Agora busca manter seus serviços disponíveis, podendo ocorrer manutenções, atualizações ou instabilidades técnicas.",
  "A marca, o software, o sistema, as funcionalidades e os elementos visuais pertencem aos seus respectivos titulares, sendo proibida sua reprodução ou utilização sem autorização.",
  "O Agenda Agora poderá atualizar estes termos sempre que necessário. O uso contínuo da plataforma estará sujeito às condições vigentes.",
  "Eventuais conflitos serão tratados conforme a legislação brasileira.",
];

/**
 * Aviso de cookies do Painel 1: aparece UMA VEZ na primeira visita.
 * As cores acompanham a identidade da página EXATAMENTE como o pop-up de Pix:
 * fundo = "Fundo dos serviços", borda = "Borda do serviço", textos = cor do
 * nome do serviço, botão = "Fundo/Texto do botão" — nada fixo.
 *
 * O overlay é um portal no <body>: ancorar na árvore da página quebra o
 * `fixed` quando algum ancestral tem transform/filter — o fundo escuro saía
 * recortado (buraco no canto direito) em Android/iOS/PC.
 */
export function CookieBanner({ appearance }: { appearance: Panel1Appearance }) {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<"aviso" | "privacidade">("aviso");

  useEffect(() => {
    setMounted(true);
    try {
      setShow(window.localStorage.getItem(CONSENT_KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);

  /* Enquanto o aviso está aberto, trava o scroll da página. Além da UX padrão
     de modal, isso remove a scrollbar: em desktops o `fixed inset-0` NÃO pinta
     a área da scrollbar (15px do lado direito), deixando a faixa "cortada"
     aparecendo de fora — o sorriso do bug em qualquer barra/espaço. */
  useEffect(() => {
    if (!show) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    try {
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
    } catch {
      // Ignora ajustes bloqueados.
    }
    return () => {
      try {
        html.style.overflow = prevHtml;
        body.style.overflow = prevBody;
      } catch {
        // Ignora.
      }
    };
  }, [show]);

  const accept = () => {
    try {
      window.localStorage.setItem(CONSENT_KEY, "1");
    } catch {
      // Sem armazenamento: só fecha o aviso nesta visita.
    }
    setShow(false);
  };

  if (!mounted || !show) return null;

  const popupBackground = appearance.service_background;
  const popupBorder = appearance.service_border;
  const titleColor = appearance.service_name_text;
  const textColor = appearance.service_name_text;
  const accent = appearance.modal_active_background;
  const accentText = appearance.modal_active_text;

  return createPortal(
    <div
      className="fixed inset-0 z-[95] grid min-h-[100dvh] place-items-center bg-black/70 p-4 [overscroll-behavior:contain]"
      role="dialog"
      aria-modal="true"
      /* width/height explícitos: 100vw inclui a área da scrollbar/desktop e
         100dvh acompanha a barra do iOS — o sombreado cobre SEMPRE a tela
         inteira, de ponta a ponta (desktop, Android e iOS). */
      style={{ width: "100vw", maxWidth: "none", height: "100dvh" }}
    >
      {view === "aviso" ? (
        <div
          className="w-full max-w-[27.5rem] rounded-2xl border px-8 py-9 shadow-[0_24px_70px_rgba(0,0,0,0.5)]"
          style={{ backgroundColor: popupBackground, borderColor: popupBorder }}
        >
          <p
            className="text-center text-[1.3rem] font-bold leading-tight"
            style={{ color: titleColor }}
          >
            Utilizamos cookies no site!
          </p>
          <p
            className="mt-3 text-left text-[1.15rem] leading-[1.4]"
            style={{ color: textColor, opacity: 0.97 }}
          >
            <span className="inline-block w-[1.2em]" aria-hidden="true" />
            Utilizamos cookies e coletamos algumas informações para personalizar sua experiência e
            melhorar nossos serviços e conteúdo. Ao continuar a navegação você concorda com essa
            coleta. Para mais detalhes, consulte nossa{" "}
            <button
              type="button"
              className="font-bold underline underline-offset-2"
              style={{ color: textColor }}
              onClick={() => setView("privacidade")}
            >
              Política de privacidade
            </button>
            .
          </p>
          <div className="mt-7 flex justify-end">
            <button
              type="button"
              onClick={accept}
              className="rounded-lg border px-6 py-3 text-[1.05rem] font-semibold transition-opacity hover:opacity-85"
              style={{ color: accentText, backgroundColor: accent, borderColor: accent }}
            >
              Concordo
            </button>
          </div>
        </div>
      ) : (
        <div
          className="flex w-full max-w-[22rem] flex-col overflow-hidden rounded-2xl border shadow-[0_24px_70px_rgba(0,0,0,0.5)]"
          style={{ backgroundColor: popupBackground, borderColor: popupBorder }}
        >
          <div className="max-h-[70dvh] overflow-y-auto p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar]:w-0">
            <button
              type="button"
              onClick={() => setView("aviso")}
              className="flex items-center gap-1 text-[14.5px] font-bold hover:opacity-80"
              style={{ color: titleColor }}
            >
              <ChevronLeft className="size-4" strokeWidth={2.5} aria-hidden="true" />
              Voltar
            </button>
            <p
              className="mt-4 text-[15.5px] font-extrabold uppercase leading-snug tracking-wide"
              style={{ color: titleColor }}
            >
              Política de Privacidade e Termos de Uso
            </p>
            <div className="mt-4 space-y-3.5" style={{ color: textColor, opacity: 0.95 }}>
              {PRIVACY_TERMS.map((paragraph) => (
                <p key={paragraph} className="text-[12.5px] leading-[1.6]">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
          <div
            className="flex justify-end border-t p-4"
            style={{ borderColor: popupBorder, backgroundColor: popupBackground }}
          >
            <button
              type="button"
              onClick={accept}
              className="rounded-lg border px-6 py-2.5 text-[13px] font-semibold transition-opacity hover:opacity-85"
              style={{ color: accentText, backgroundColor: accent, borderColor: accent }}
            >
              Concordo
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
