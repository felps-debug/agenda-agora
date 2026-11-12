import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/error-page";
import { isValidCpf } from "@/lib/cpf";
import {
  createSubscriptionCharge,
  getOwnerCpfStatus,
  getSubscriptionChargeStatus,
  saveOwnerCpf,
} from "@/lib/subscription-charge.functions";

/** Máscara 000.000.000-00 enquanto digita. */
function maskCpf(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Charge = {
  chargeId: string;
  qrCode: string;
  qrImageUrl: string | null;
  amountCents: number;
};

/**
 * US7 — Pagamento da assinatura (30 dias) por Pix via Ag Pay.
 *
 * Usado dentro do pop-up "Confirmar assinatura". O card só mostra o botão
 * "Continuar para PIX" — sem campo de CPF. Ao continuar abre um segundo pop-up:
 *   1. se ainda não há CPF salvo (primeira vez): pede o CPF do pagador, que fica salvo no
 *      cadastro do negócio e não é pedido de novo;
 *   2. gera a cobrança e mostra o QR Code + copia-e-cola, com poll até o webhook confirmar.
 */
export function SubscriptionPixPayment({
  businessId,
  onPaid,
}: {
  businessId: string;
  onPaid?: () => void;
}) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createSubscriptionCharge);
  const statusFn = useServerFn(getSubscriptionChargeStatus);
  const saveCpfFn = useServerFn(saveOwnerCpf);
  const cpfStatusFn = useServerFn(getOwnerCpfStatus);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [charge, setCharge] = useState<Charge | null>(null);
  const [cpf, setCpf] = useState("");
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const cpfStatus = useQuery({
    queryKey: ["owner-cpf-status", businessId],
    queryFn: () => cpfStatusFn({ data: { businessId } }),
    staleTime: 60_000,
  });
  const hasSavedCpf = cpfStatus.data?.hasCpf === true;

  const pay = useMutation({
    mutationFn: async () => {
      const result = await createFn({ data: { businessId, method: "pix" } });
      const qr = result.qrCode?.trim();
      if (!qr) {
        throw new Error("O código Pix ainda não está disponível. Tente novamente em instantes.");
      }
      const qrImageUrl = await QRCode.toDataURL(qr, { margin: 1, width: 300 }).catch(() => null);
      return { chargeId: result.chargeId, qrCode: qr, qrImageUrl, amountCents: result.amountCents };
    },
    onMutate: () => setFailed(null),
    onSuccess: (result) => setCharge(result),
    onError: (error: Error) => {
      // CPF ausente no cadastro: reabre a etapa de CPF; qualquer erro fica visível.
      if (/CPF/i.test(error.message)) {
        void queryClient.invalidateQueries({ queryKey: ["owner-cpf-status", businessId] });
      }
      const message = friendlyError(error);
      setFailed(message);
      toast.error(message);
    },
  });

  const saveCpf = useMutation({
    mutationFn: () => saveCpfFn({ data: { businessId, cpf } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["owner-cpf-status", businessId] });
      pay.mutate();
    },
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  // Poll do status enquanto a cobrança estiver pendente.
  const chargeId = charge?.chargeId;
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  useEffect(() => {
    if (!chargeId || paid) return;
    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const s = await statusFn({ data: { chargeId } });
        if (!active) return;
        if (s.status === "paid") {
          setPaid(true);
          window.clearInterval(timer);
          toast.success("Assinatura paga! Acesso renovado.");
          void queryClient.invalidateQueries({ queryKey: ["billing-cycle"] });
          onPaidRef.current?.();
        } else if (s.status === "failed" || s.status === "expired") {
          window.clearInterval(timer);
          toast.error("A cobrança expirou. Gere um novo Pix.");
          setCharge(null);
          setFailed("A cobrança expirou. Gere um novo Pix.");
        }
      } catch {
        // Ignora erros transitórios do poll.
      }
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [chargeId, paid, statusFn, queryClient]);

  const copy = () => {
    if (!charge?.qrCode) return;
    void navigator.clipboard.writeText(charge.qrCode).then(
      () => {
        setCopied(true);
        toast.success("Código Pix copiado!");
      },
      () => toast.error("Não foi possível copiar. Selecione o código e copie manualmente."),
    );
  };

  const busy = pay.isPending || saveCpf.isPending;
  const cpfValid = isValidCpf(cpf);

  // "Continuar para PIX": abre o 2º pop-up. Com CPF salvo já gera a cobrança direto.
  const start = () => {
    setFailed(null);
    setDialogOpen(true);
    if (hasSavedCpf) pay.mutate();
  };

  const closeDialog = () => {
    if (busy) return;
    setDialogOpen(false);
    setFailed(null);
  };

  const submitCpf = () => {
    if (!cpfValid) {
      toast.error("Informe um CPF válido.");
      return;
    }
    saveCpf.mutate();
  };

  if (paid) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center text-sm font-semibold text-emerald-300">
        Pagamento confirmado — acesso renovado por mais 30 dias.
      </div>
    );
  }

  const needsCpfStep = !charge && !hasSavedCpf && !pay.isPending;

  let dialogBody;
  if (charge) {
    dialogBody = (
      <div className="space-y-3 text-center">
        <p className="text-sm font-semibold text-white">Pague {brl(charge.amountCents)} com Pix</p>
        {charge.qrImageUrl ? (
          <img
            src={charge.qrImageUrl}
            alt="QR Code Pix da assinatura"
            className="mx-auto size-56 rounded-lg bg-white p-2"
          />
        ) : null}
        <p className="text-xs text-[#8b8e96]">
          Escaneie o QR Code ou use o copia-e-cola no app do seu banco.
        </p>
        <textarea
          readOnly
          value={charge.qrCode}
          aria-label="Código Pix copia e cola"
          onFocus={(e) => e.currentTarget.select()}
          rows={3}
          className="w-full resize-none rounded-lg border border-white/15 bg-transparent px-3 py-2 text-xs text-white/80"
        />
        <Button type="button" variant="outline" onClick={copy}>
          {copied ? "Código copiado!" : "Copiar código Pix"}
        </Button>
        <p className="text-xs text-[#8b8e96]">Aguardando confirmação do pagamento…</p>
      </div>
    );
  } else if (failed && !busy) {
    dialogBody = (
      <div className="space-y-4 text-center">
        <p className="text-sm text-white" role="alert">
          {failed}
        </p>
        <button
          type="button"
          onClick={() => (hasSavedCpf ? pay.mutate() : setFailed(null))}
          className="h-11 w-full rounded-xl bg-white text-sm font-bold text-black transition-colors hover:bg-[#e5e5e5]"
        >
          Tentar novamente
        </button>
      </div>
    );
  } else if (needsCpfStep) {
    dialogBody = (
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          submitCpf();
        }}
      >
        <div>
          <label
            htmlFor="cpf-pagador"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#8b8e96]"
          >
            CPF do pagador
          </label>
          <input
            id="cpf-pagador"
            value={cpf}
            onChange={(e) => setCpf(maskCpf(e.target.value))}
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="000.000.000-00"
            maxLength={14}
            className="h-11 w-full rounded-[10px] border border-[var(--c-2a2e35)] bg-[var(--c-101218)] px-3 text-sm text-white placeholder:text-[#6d717a] focus:border-[var(--c-2f83ff)]/60 focus:outline-none"
          />
          <p className="mt-1.5 text-[11px] text-[#8b8e96]">
            Necessário para emitir a cobrança. Fica salvo no seu perfil e não pedimos de novo.
          </p>
        </div>
        <button
          type="submit"
          disabled={busy || !cpfValid}
          className="h-11 w-full rounded-xl bg-white text-sm font-bold text-black transition-colors hover:bg-[#e5e5e5] disabled:opacity-50"
        >
          Gerar Pix
        </button>
      </form>
    );
  } else {
    dialogBody = (
      <p className="py-6 text-center text-sm text-white" role="status">
        Gerando Pix...
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={cpfStatus.isPending}
        className="h-11 w-full rounded-xl bg-white text-sm font-bold text-black transition-colors hover:bg-[#e5e5e5] disabled:opacity-50"
      >
        Continuar para PIX
      </button>
      {dialogOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="aa-popup-full fixed inset-0 z-[80] overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-label="Pagamento por Pix"
            >
              <button
                type="button"
                aria-label="Fechar"
                onClick={closeDialog}
                className="fixed inset-0 h-full w-full cursor-default bg-black/60"
              />
              <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative w-full max-w-sm rounded-2xl border border-[var(--c-272a30)] bg-[var(--c-0b0b0e)] p-6">
                  <button
                    type="button"
                    aria-label="Fechar"
                    onClick={closeDialog}
                    className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-white/70 hover:bg-white/10"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                  <h2 className="mb-4 pr-8 text-center text-lg font-bold text-white">
                    {charge ? "Pagar com Pix" : needsCpfStep ? "Seu CPF" : "Pix"}
                  </h2>
                  {dialogBody}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
