import { useEffect, useRef, useState, type CSSProperties } from "react";
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

type PaymentDialogProps = {
  chargeId: string;
  booking: { amountCents: number; expiresAt: string | null } | null;
  reservedAmountCents: number | null;
  liquidGlass?: boolean;
  /** Tokens da paleta: o diálogo é renderizado num portal, fora da raiz que os define. */
  liquidStyle?: CSSProperties;
  onClose: () => void;
};

export default function PaymentDialog({
  chargeId,
  booking,
  reservedAmountCents,
  liquidGlass = false,
  liquidStyle,
  onClose,
}: PaymentDialogProps) {
  // Snapshot gravado no servidor (deposit_payments.amount_cents); nada é recalculado aqui.
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
      // A AgPay só devolve o código "copia e cola"; a imagem do QR é gerada aqui
      // mesmo, no navegador, a partir desse texto.
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

  if (paid)
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent
          className={`max-w-md text-center ${
            liquidGlass ? "liquid-glass-surface liquid-glass-hero liquid-glass-dialog" : ""
          }`}
          style={liquidGlass ? liquidStyle : undefined}
        >
          <Check className="mx-auto size-10 text-primary" />
          <h2 className="font-display text-xl font-bold">Agendamento confirmado!</h2>
          <p className="text-sm text-muted-foreground">
            Sinal recebido. Seu horário está reservado.
          </p>
          <Button onClick={onClose}>Fechar</Button>
        </DialogContent>
      </Dialog>
    );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={`max-h-[90vh] max-w-md overflow-y-auto text-center ${
          liquidGlass ? "liquid-glass-surface liquid-glass-hero liquid-glass-dialog" : ""
        }`}
        style={liquidGlass ? liquidStyle : undefined}
      >
        <h2 className="font-display text-xl font-bold">Agendamento aguardando pagamento</h2>
        <p className="text-sm text-muted-foreground">
          Para confirmar seu agendamento, efetue o pagamento do sinal via Pix.
        </p>
        <p className="mx-auto w-fit rounded-md bg-muted px-4 py-1 text-sm font-semibold">
          {amountCents === null ? "Carregando valor do sinal..." : formatPrice(amountCents)}
        </p>
        <Button
          className="mx-auto w-fit"
          disabled={generate.isPending || !!pix}
          onClick={requestPix}
          aria-busy={generate.isPending}
        >
          {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {generate.isPending
            ? "Gerando código Pix..."
            : pixError
              ? "Tentar novamente"
              : "Gerar código Pix"}
        </Button>
        {pixError && (
          <p role="alert" className="text-sm text-destructive">
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
              <p className="text-sm font-medium">Valor do Pix: {formatPrice(amountCents)}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Use a função Pix copia e cola do seu banco para concluir o pagamento.
            </p>
            <p className="min-w-0 truncate rounded-md bg-muted px-3 py-2 text-left text-xs">
              {pix.qrCode}
            </p>
            <Button
              variant="secondary"
              className="mx-auto w-fit"
              onClick={() => {
                void navigator.clipboard.writeText(pix.qrCode);
                setCopied(true);
                toast.success("Código Pix copiado!");
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copiar código
              pix
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Você tem 5 minutos para efetuar seu pagamento antes que seu agendamento seja cancelado
          automaticamente
        </p>
        <p className="font-display text-lg font-bold">
          Tempo restante: {mm}:{ss}
        </p>
        <Button variant="outline" className="mx-auto w-fit" onClick={() => setConfirmCancel(true)}>
          Cancelar pagamento
        </Button>

        <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
          <DialogContent
            className={`max-w-sm text-center ${
              liquidGlass ? "liquid-glass-surface liquid-glass-regular liquid-glass-dialog" : ""
            }`}
            style={liquidGlass ? liquidStyle : undefined}
          >
            <h3 className="text-base font-semibold">Pagamento Obrigatório</h3>
            <p className="text-sm">Você confirma o cancelamento desse agendamento?</p>
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
