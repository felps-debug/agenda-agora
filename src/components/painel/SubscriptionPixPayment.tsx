import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/error-page";
import {
  createSubscriptionCharge,
  getSubscriptionChargeStatus,
  saveOwnerCpf,
} from "@/lib/subscription-charge.functions";

/**
 * US7 — Pagamento da assinatura (30 dias) por Pix via Ag Pay.
 * Autossuficiente: se faltar o CPF do responsável, captura inline (salva no cadastro),
 * gera o Pix (QR + copia-e-cola) e faz poll até o pagamento ser confirmado (webhook
 * renova o access_until). Basta renderizar <SubscriptionPixPayment businessId=... />.
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

  const [charge, setCharge] = useState<{ chargeId: string; qrCode: string; qrImageUrl: string | null } | null>(null);
  const [needsCpf, setNeedsCpf] = useState(false);
  const [cpf, setCpf] = useState("");
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);

  const pay = useMutation({
    mutationFn: async () => {
      const result = await createFn({ data: { businessId, method: "pix" } });
      const qr = result.qrCode?.trim();
      const qrImageUrl = qr ? await QRCode.toDataURL(qr, { margin: 1, width: 300 }).catch(() => null) : null;
      return { chargeId: result.chargeId, qrCode: qr ?? "", qrImageUrl };
    },
    onSuccess: (result) => {
      setNeedsCpf(false);
      setCharge(result);
    },
    onError: (error: Error) => {
      if (/CPF/i.test(error.message)) {
        setNeedsCpf(true);
      } else {
        toast.error(friendlyError(error));
      }
    },
  });

  const saveCpf = useMutation({
    mutationFn: () => saveCpfFn({ data: { businessId, cpf } }),
    onSuccess: () => {
      setNeedsCpf(false);
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
    void navigator.clipboard.writeText(charge.qrCode);
    setCopied(true);
    toast.success("Código Pix copiado!");
  };

  if (paid) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center text-sm font-semibold text-emerald-300">
        Pagamento confirmado — acesso renovado por mais 30 dias.
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
          onChange={(e) => setCpf(e.target.value)}
          inputMode="numeric"
          placeholder="CPF (somente números)"
          aria-label="CPF do responsável"
          className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm"
        />
        <Button
          type="button"
          onClick={() => saveCpf.mutate()}
          disabled={saveCpf.isPending || cpf.replace(/\D/g, "").length !== 11}
        >
          {saveCpf.isPending ? "Salvando..." : "Salvar CPF e gerar Pix"}
        </Button>
      </div>
    );
  }

  if (!charge) {
    return (
      <Button type="button" onClick={() => pay.mutate()} disabled={pay.isPending}>
        {pay.isPending ? "Gerando Pix..." : "Pagar assinatura por Pix"}
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4 text-center">
      {charge.qrImageUrl ? (
        <img src={charge.qrImageUrl} alt="QR Code Pix da assinatura" className="mx-auto size-56" />
      ) : null}
      <p className="text-xs text-muted-foreground">
        Escaneie o QR Code ou use o copia-e-cola no app do seu banco.
      </p>
      <Button type="button" variant="outline" onClick={copy}>
        {copied ? "Código copiado!" : "Copiar código Pix"}
      </Button>
      <p className="text-xs text-muted-foreground">Aguardando confirmação do pagamento…</p>
    </div>
  );
}
