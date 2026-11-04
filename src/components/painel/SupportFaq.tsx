import { useMemo, useState } from "react";
import { ChevronDown, MessageCircle, Search } from "lucide-react";

const WHATSAPP_URL =
  "https://wa.me/5511981998037?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20o%20Agenda%20Agora.";

const FAQ_ITEMS = [
  {
    cat: "Serviços",
    q: "Como cadastro um serviço?",
    a: "No painel, acesse a área de serviços e selecione a opção para adicionar um novo serviço. Informe o nome, a duração e o valor, quando solicitado. Mantenha essas informações atualizadas para que seus clientes vejam os dados corretos ao agendar.",
  },
  {
    cat: "Funcionamento",
    q: "Como configuro meus horários disponíveis?",
    a: "Acesse a opção funcionamento no menu e informe seus dias e horários de atendimento. Considere também os intervalos, pausas e dias em que não estará disponível. Os horários exibidos aos clientes dependem dessas configurações e dos compromissos já registrados.",
  },
  {
    cat: "Agendamento",
    q: "Como meu cliente faz um agendamento?",
    a: "O cliente acessa sua página, escolhe um serviço e consulta as opções de horário disponíveis. Depois, preenche as informações solicitadas e conclui o agendamento.",
  },
  {
    cat: "Agenda",
    q: "Como acompanho os agendamentos recebidos?",
    a: "Acesse a agenda no painel para consultar os horários e os dados dos atendimentos registrados. Verifique a agenda com frequência para se organizar e manter seus compromissos atualizados.",
  },
  {
    cat: "Bloqueios",
    q: "Como bloqueio um horário em que não posso atender?",
    a: "Use a opção de bloqueio ou indisponibilidade na agenda. Informe o período em que não poderá atender para evitar que esse horário apareça como disponível aos clientes.",
  },
  {
    cat: "Pagamentos",
    q: "Como funcionam o sinal e os pagamentos?",
    a: "A disponibilidade de sinal ou pagamento online depende dos recursos habilitados para o seu estabelecimento. Confira as opções exibidas no painel e informe ao cliente, com clareza, os valores e as condições definidos por você antes de confirmar o atendimento.",
  },
] as const;

/** Aba "Suporte & FAQ" da conta: busca, categorias e respostas sanfona. */
export function SupportFaq() {
  const [term, setTerm] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [open, setOpen] = useState<number | null>(null);

  const cats = useMemo(() => ["all", ...new Set(FAQ_ITEMS.map((i) => i.cat))], []);
  const catLabel = (c: string) => (c === "all" ? "Todas" : c);

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    return FAQ_ITEMS.map((item, index) => ({ ...item, index })).filter(
      (item) =>
        (cat === "all" || item.cat === cat) &&
        (!t ||
          item.q.toLowerCase().includes(t) ||
          item.a.toLowerCase().includes(t) ||
          item.cat.toLowerCase().includes(t)),
    );
  }, [term, cat]);

  return (
    <div>
      <div className="rounded-[18px] border border-[var(--c-272a30)] bg-[#050607] p-5 sm:p-6">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#656871]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar dúvida... (ex: serviço, horário, pix, bloqueio)"
            aria-label="Buscar dúvida"
            className="h-11 w-full rounded-[0.7rem] border border-[#30333a] bg-[var(--c-0d0e11)] pl-9 pr-3 text-sm text-[var(--c-e7e9ed)] outline-none placeholder:text-[#656871] focus-visible:border-[var(--c-2f83ff)]"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Categorias">
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              aria-pressed={cat === c}
              className={`rounded-[10px] px-3 py-[5px] text-[0.78rem] font-medium leading-normal transition-colors ${
                cat === c
                  ? "border border-[var(--c-rgba-51-125-255-a0d55)] bg-[linear-gradient(135deg,var(--c-rgba-31-80-180-a0d85),var(--c-rgba-22-119-255-a0d55))] text-white"
                  : "border border-[rgba(143,94,11,0.65)] bg-[rgba(143,94,11,0.12)] text-[#8f5e0b] opacity-90 hover:opacity-100"
              }`}
            >
              {catLabel(c)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3.5 flex flex-col gap-2">
        {filtered.map(({ cat: itemCat, q, a, index }) => {
          const isOpen = open === index;
          return (
            <div
              key={index}
              className="overflow-hidden rounded-[18px] border border-[var(--c-272a30)] bg-[#050607]"
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : index)}
                aria-expanded={isOpen}
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--c-rgba-59-130-246-a0d04)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="mb-1 block text-[0.72rem] uppercase tracking-[0.05em] text-[var(--c-69a2ff)]">
                    {itemCat}
                  </span>
                  <span className="block text-[0.94rem] font-medium text-[var(--c-f1f2f4)]">{q}</span>
                </span>
                <ChevronDown
                  className={`size-5 shrink-0 text-[#656871] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
              {isOpen && (
                <div className="border-t border-white/[0.06] px-4 pb-3.5 pt-2.5 text-sm leading-relaxed text-[var(--c-9aa4b2)]">
                  {a}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-[18px] border border-[var(--c-272a30)] bg-[#050607] p-6 text-center">
            <p className="text-sm text-[var(--c-9aa4b2)]">
              Nenhuma resposta encontrada para <strong>{term}</strong>.
            </p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-[#30333a] bg-[var(--c-15171b)] px-4 text-sm font-semibold text-white transition-colors hover:border-[var(--c-2f83ff)]/50"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              Falar com suporte no WhatsApp
            </a>
          </div>
        )}
      </div>

      <div className="mt-3.5 rounded-[18px] border border-[var(--c-rgba-59-130-246-a0d3)] bg-[linear-gradient(135deg,var(--c-rgba-59-130-246-a0d08),var(--c-rgba-59-130-246-a0d04))] p-5">
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="text-[1.8rem]" aria-hidden="true">
            💬
          </div>
          <div className="min-w-[220px] flex-1">
            <p className="font-semibold text-[var(--c-3b82f6)]">Não achou sua dúvida?</p>
            <p className="text-sm text-[var(--c-9aa4b2)]">
              Atendimento humano em horário comercial (seg–sex, 9h–18h).
            </p>
          </div>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#30333a] bg-[var(--c-15171b)] px-4 text-sm font-semibold text-white transition-colors hover:border-[var(--c-2f83ff)]/50"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            WhatsApp do suporte
          </a>
        </div>
      </div>
    </div>
  );
}
