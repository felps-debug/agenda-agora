import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
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
 * - `mode="inline"` (padrão): botão "Pagar assinatura por Pix"; pede o CPF só se faltar.
 * - `mode="checkout"`: usado dentro do pop-up "Confirmar assinatura". Mostra o campo
 *   "CPF do pagador" só enquanto não houver CPF salvo (primeira vez); o CPF fica salvo no
 *   cadastro do negócio e não é pedido de novo. "Continuar para PIX" gera a cobrança e
 *   troca o conteúdo por QR Code + copia-e-cola, com poll até o webhook confirmar.
 */
export function SubscriptionPixPayment({
  businessId,
  onPaid,
  mode = "inline",
}: {
  businessId: string;
  onPaid?: () => void;
  mode?: "inline" | "checkout";
}) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createSubscriptionCharge);
  const statusFn = useServerFn(getSubscriptionChargeStatus);
  const saveCpfFn = useServerFn(saveOwnerCpf);
  const cpfStatusFn = useServerFn(getOwnerCpfStatus);

  const [charge, setCharge] = useState<Charge | null>(null);
  const [needsCpf, setNeedsCpf] = useState(false);
  const [cpf, setCpf] = useState("");
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);

  const cpfStatus = useQuery({
    queryKey: ["owner-cpf-status", businessId],
    queryFn: () => cpfStatusFn({ data: { businessId } }),
    enabled: mode === "checkout",
    staleTime: 60_000,
  });
  const hasSavedCpf = cpfStatus.data?.hasCpf === true;
  const askCpf = mode === "checkout" ? !hasSavedCpf && !cpfStatus.isPending : needsCpf;

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
    onSuccess: (result) => {
      setNeedsCpf(false);
      setCharge(result);
    },
    onError: (error: Error) => {
      if (/CPF/i.test(error.message)) {
        setNeedsCpf(true);
        void queryClient.invalidateQueries({ queryKey: ["owner-cpf-status", businessId] });
      } else {
        toast.error(friendlyError(error));
      }
    },
  });

  const saveCpf = useMutation({
    mutationFn: () => saveCpfFn({ data: { businessId, cpf } }),
    onSuccess: async () => {
      setNeedsCpf(false);
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

  const cpfValid = isValidCpf(cpf);
  const busy = pay.isPending || saveCpf.isPending;
  const submit = () => {
    if (askCpf) {
      if (!cpfValid) {
        toast.error("Informe um CPF válido.");
        return;
      }
      saveCpf.mutate();
    } else {
      pay.mutate();
    }
  };

  if (paid) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center text-sm font-semibold text-emerald-300">
        Pagamento confirmado — acesso renovado por mais 30 dias.
      </div>
    );
  }

  // QR Code + copia-e-cola (as duas variações).
  if (charge) {
    return (
      <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4 text-center">
        {mode === "checkout" ? (
          <p className="text-sm font-semibold text-white">
            Pague {brl(charge.amountCents)} com Pix
          </p>
        ) : null}
        {charge.qrImageUrl ? (
          <img
            src={charge.qrImageUrl}
            alt="QR Code Pix da assinatura"
            className="mx-auto size-56 rounded-lg bg-white p-2"
          />
        ) : null}
        <p className="text-xs text-muted-foreground">
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
        <p className="text-xs text-muted-foreground">Aguardando confirmação do pagamento…</p>
      </div>
    );
  }

  if (mode === "checkout") {
    return (
      <div className="space-y-3">
        {askCpf ? (
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
              placeholder="000.000.000-00"
              maxLength={14}
              className="h-11 w-full rounded-[10px] border border-[var(--c-2a2e35)] bg-[var(--c-101218)] px-3 text-sm text-white placeholder:text-[#6d717a] focus:border-[var(--c-2f83ff)]/60 focus:outline-none"
            />
            <p className="mt-1.5 text-[11px] text-[#8b8e96]">
              Necessário para emitir a cobrança. Fica salvo no seu perfil e não pedimos de novo.
            </p>
          </div>
        ) : hasSavedCpf ? (
          <p className="text-[11px] text-[#8b8e96]">
            CPF do pagador: {cpfStatus.data?.hasCpf ? cpfStatus.data.masked : ""}
          </p>
        ) : null}
        <button
          type="button"
          onClick={submit}
          disabled={busy || cpfStatus.isPending || (askCpf && !cpfValid)}
          className="h-11 w-full rounded-xl bg-white text-sm font-bold text-black transition-colors hover:bg-[#e5e5e5] disabled:opacity-50"
        >
          {busy ? "Gerando Pix..." : "Continuar para PIX"}
        </button>
      </div>
    );
  }

  if (needsCpf) {
    return (
      <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-muted-foreground">
          Informe o CPF do responsável para gerar o Pix da assinatura.
        </p>
        <input
          value={cpf}
          onChange={(e) => setCpf(maskCpf(e.target.value))}
          inputMode="numeric"
          placeholder="000.000.000-00"
          aria-label="CPF do responsável"
          className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm"
        />
        <Button type="button" onClick={() => saveCpf.mutate()} disabled={saveCpf.isPending || !cpfValid}>
          {saveCpf.isPending ? "Salvando..." : "Salvar CPF e gerar Pix"}
        </Button>
      </div>
    );
  }

  return (
    <Button type="button" onClick={() => pay.mutate()} disabled={pay.isPending}>
      {pay.isPending ? "Gerando Pix..." : "Pagar assinatura por Pix"}
    </Button>
  );
}
