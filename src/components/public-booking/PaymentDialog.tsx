import { useEffect, useRef, useState } from "react";
import { friendlyError } from "@/lib/error-page";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import {
  cancelDepositBooking,
  generateDepositPix,
  getDepositStatus,
} from "@/lib/booking.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Panel1Appearance } from "@/lib/panel1-config";

type PaymentDialogProps = {
  chargeId: string;
  booking: { amountCents: number; expiresAt: string | null } | null;
  reservedAmountCents: number | null;
  appearance: Panel1Appearance;
  onClose: () => void;
};

export default function PaymentDialog({
  chargeId,
  booking,
  reservedAmountCents,
  appearance,
  onClose,
}: PaymentDialogProps) {
  const amountCents = booking?.amountCents ?? reservedAmountCents;
  const pixFn = useServerFn(generateDepositPix);
  const statusFn = useServerFn(getDepositStatus);
  const cancelFn = useServerFn(cancelDepositBooking);
  const generatingPix = useRef(false);
  const [pix, setPix] = useState<{
    qrCode: string;
    qrImageUrl: string | null;
  } | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [paid, setPaid] = useState(false);
  const [left, setLeft] = useState(300);

  const expiresAt = booking?.expiresAt ? new Date(booking.expiresAt).getTime() : null;

  useEffect(() => {
    const tick = () => {
      if (!expiresAt) return;
      setLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  useEffect(() => {
    if (paid) return;
    const id = setInterval(async () => {
      try {
        const r = await statusFn({ data: { chargeId } });
        if (r.status === "pago") setPaid(true);
        if (r.status === "expirado") {
          toast.error("O prazo do Pix acabou e o agendamento foi cancelado.");
          onClose();
        }
      } catch {
        /* tenta de novo */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [chargeId, paid, statusFn, onClose]);

  const generate = useMutation({
    mutationFn: async () => {
      const result = await pixFn({ data: { chargeId } });
      const qrCode = result.qrCode?.trim();
      if (!qrCode) {
        throw new Error("O código Pix ainda não está disponível. Tente novamente.");
      }
      const qrImageUrl = await QRCode.toDataURL(qrCode, { margin: 1, width: 320 }).catch(
        () => null,
      );
      return { qrCode, qrImageUrl };
    },
    onSuccess: (result) => {
      setPix(result);
      setPixError(null);
    },
    onError: (error: Error) => {
      setPix(null);
      const message = error.message;
      if (/prazo|expirad|não está mais ativa/i.test(message)) {
        setPixError("O prazo desta reserva terminou. Faça um novo agendamento.");
      } else if (/não está habilitado|subconta|análise/i.test(message)) {
        setPixError("Este estabelecimento ainda não pode receber Pix. Entre em contato com ele.");
      } else {
        setPixError("Não foi possível gerar o Pix agora. Tente novamente.");
      }
    },
    onSettled: () => {
      generatingPix.current = false;
    },
  });

  const requestPix = () => {
    if (generatingPix.current || generate.isPending || pix) return;
    generatingPix.current = true;
    setPixError(null);
    generate.mutate();
  };

  const handleCopyPix = () => {
    if (!pix) return;
    void navigator.clipboard.writeText(pix.qrCode);
    setCopied(true);
    toast.success("Código Pix copiado!");
  };

  const cancel = useMutation({
    mutationFn: () => cancelFn({ data: { chargeId } }),
    onSuccess: () => {
      toast.success("Agendamento cancelado.");
      onClose();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  // Cores 100% ligadas à identidade do Painel 1 (menu Aparência):
  // fundo = "Fundo dos serviços" · textos = nome do serviço · botões = "Fundo/Texto do botão".
  const popupBackground = appearance.service_background || "#ffffff";
  const popupBorder = appearance.service_border || "transparent";
  const titleColor = appearance.service_name_text || appearance.modal_text;
  const textColor = appearance.service_text || appearance.modal_text;
  const accent = appearance.modal_active_background;
  const accentText = appearance.modal_active_text;
  const codeBoxBackground = appearance.modal_hover_background || accent;

  if (paid)
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent
          className="max-w-md rounded-3xl p-6 text-center shadow-xl"
          style={{ backgroundColor: popupBackground, borderColor: popupBorder }}
        >
          <Check className="mx-auto size-10" style={{ color: accent }} />
          <h2 className="font-display text-xl font-bold" style={{ color: titleColor }}>
            Agendamento confirmado!
          </h2>
          <p className="text-sm" style={{ color: textColor, opacity: 0.85 }}>
            Sinal recebido. Seu horário está reservado.
          </p>
          <Button
            onClick={onClose}
            className="rounded-xl"
            style={{ backgroundColor: accent, color: accentText }}
          >
            Fechar
          </Button>
        </DialogContent>
      </Dialog>
    );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[90vh] max-w-md overflow-y-auto rounded-3xl p-6 text-center shadow-xl"
        style={{ backgroundColor: popupBackground, borderColor: popupBorder }}
      >
        <h2 className="font-display text-xl font-bold" style={{ color: titleColor }}>
          Agendamento Aguardando Pagamento
        </h2>
        <p className="text-sm" style={{ color: textColor, opacity: 0.85 }}>
          Para confirmar seu agendamento é necessário efetuar o pagamento via pix.
        </p>
        <p className="text-sm" style={{ color: textColor, opacity: 0.85 }}>
          Selecione a forma de pagamento desejada
        </p>
        <p className="text-sm" style={{ color: textColor, opacity: 0.85 }}>
          Clique no valor e após isso clique em "GERAR CÓDIGO PIX" para continuar com seu pagamento.
        </p>
        <p
          className="mx-auto w-fit rounded-full px-4 py-1 text-sm font-semibold"
          style={{ backgroundColor: `${accent}24`, color: accent }}
        >
          {amountCents === null ? "Carregando valor do sinal..." : formatPrice(amountCents)}
        </p>
        <Button
          className="mx-auto w-fit rounded-xl"
          style={{ backgroundColor: accent, color: accentText }}
          disabled={generate.isPending || !!pix}
          onClick={requestPix}
          aria-busy={generate.isPending}
        >
          {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {generate.isPending
            ? "Gerando Código Pix..."
            : pixError
              ? "Tentar novamente"
              : "Gerar Código Pix"}
        </Button>
        {pixError && (
          <p role="alert" className="text-sm" style={{ color: titleColor }}>
            {pixError}
          </p>
        )}

        {pix && (
          <div className="min-w-0 space-y-2">
            {pix.qrImageUrl && (
              <img
                src={pix.qrImageUrl}
                alt="QR Code do Pix para pagar o sinal"
                decoding="async"
                className="mx-auto size-56 rounded-lg bg-white p-2"
                onError={() =>
                  setPix((current) => (current ? { ...current, qrImageUrl: null } : current))
                }
              />
            )}
            {amountCents !== null && (
              <p className="text-sm font-medium" style={{ color: textColor }}>
                Valor do Pix: {formatPrice(amountCents)}
              </p>
            )}
            <p className="text-xs" style={{ color: textColor, opacity: 0.85 }}>
              Utilize a função copia e cola de seu banco para efetuar o pagamento via pix
            </p>
            <p
              className="min-w-0 truncate rounded-md px-3 py-2 text-left text-xs"
              style={{ backgroundColor: codeBoxBackground, color: accentText }}
            >
              {pix.qrCode}
            </p>
            <button
              onClick={handleCopyPix}
              style={{ backgroundColor: accent, color: accentText }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 font-medium transition-all hover:opacity-90"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Código copiado!" : "Copiar código pix"}
            </button>
          </div>
        )}

        <p className="text-xs" style={{ color: textColor, opacity: 0.85 }}>
          Você tem 5 minutos para efetuar seu pagamento antes que seu agendamento seja cancelado
          automaticamente
        </p>
        <p className="font-display text-lg font-bold" style={{ color: accent }}>
          Tempo restante: {mm}:{ss}
        </p>
        <Button
          className="mx-auto w-fit rounded-xl"
          style={{ backgroundColor: accent, color: accentText }}
          onClick={() => setConfirmCancel(true)}
        >
          Cancelar pagamento
        </Button>

        <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
          <DialogContent
            className="max-w-sm rounded-3xl p-6 text-center shadow-xl"
            style={{ backgroundColor: popupBackground, borderColor: popupBorder }}
          >
            <h3 className="text-base font-semibold" style={{ color: titleColor }}>
              Pagamento Obrigatório
            </h3>
            <p className="text-sm" style={{ color: textColor, opacity: 0.85 }}>
              Você confirma o cancelamento desse agendamento?
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
                Não quero cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate()}
              >
                Sim, quero cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}