import { createFileRoute } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-page";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircle, QrCode, RefreshCw, Unplug } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader, NoBusiness } from "@/components/painel/PageHeader";
import { useBusiness } from "@/lib/business";
import {
  connectWhatsapp,
  disconnectWhatsapp,
  getWhatsappStatus,
  refreshWhatsappQr,
} from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/painel/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações — Agenda Agora" },
      { name: "description", content: "Conecte o WhatsApp do negócio via QR Code." },
      { property: "og:title", content: "Integrações — Agenda Agora" },
      { property: "og:description", content: "Conecte o WhatsApp do negócio via QR Code." },
    ],
  }),
  component: IntegracoesPage,
});

function IntegracoesPage() {
  const { businessId, businesses } = useBusiness();
  const business = businesses.find((b) => b.id === businessId);
  const queryClient = useQueryClient();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const connectFn = useServerFn(connectWhatsapp);
  const refreshFn = useServerFn(refreshWhatsappQr);
  const statusFn = useServerFn(getWhatsappStatus);
  const disconnectFn = useServerFn(disconnectWhatsapp);

  const statusQuery = useQuery({
    queryKey: ["whatsapp-status", businessId],
    queryFn: () => statusFn({ data: { businessId: businessId! } }),
    enabled: !!businessId,
    refetchInterval: (query) => (query.state.data?.status === "conectado" ? false : 15_000),
    refetchIntervalInBackground: false,
  });
  const status = statusQuery.data?.status ?? "desconectado";

  const connect = useMutation({
    mutationFn: () => connectFn({ data: { businessId: businessId! } }),
    onSuccess: (data) => {
      setQrCode(data.qrCode);
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
      if (!data.qrCode) toast.info("Instância criada. Gere o QR Code.");
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const refreshQr = useMutation({
    mutationFn: () => refreshFn({ data: { businessId: businessId! } }),
    onSuccess: (data) => {
      if (data.qrCode) setQrCode(data.qrCode);
      else toast.info("QR Code indisponível no momento. Tente de novo.");
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectFn({ data: { businessId: businessId! } }),
    onSuccess: () => {
      setQrCode(null);
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
      toast.success("WhatsApp desconectado.");
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  if (!businessId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Integrações" subtitle="Conecte o WhatsApp do seu negócio" />
        <NoBusiness />
      </div>
    );
  }

  const connected = status === "conectado";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrações"
        subtitle={`Mensagens automáticas para os clientes de ${business?.name ?? "seu negócio"}`}
      />

      <section className="mx-auto max-w-2xl space-y-3">
        <div className="integration-gold-panel p-4 sm:p-5">
          <div className="relative z-10 space-y-4">
            <div className="flex items-start gap-3">
              <span className="integration-gold-icon integration-whatsapp-icon">
                <MessageCircle className="size-[1.05rem]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-[-0.025em] text-[#f1f1f3]">
                  WhatsApp
                </h2>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6f7078]">
                  Status:
                  {statusQuery.isLoading ? (
                    <span className="rounded-full border border-[#2f2f34] bg-[#151518] px-2.5 py-1 text-[0.68rem] font-medium text-[#777780]">
                      verificando…
                    </span>
                  ) : connected ? (
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/[0.08] px-2.5 py-1 text-[0.68rem] font-semibold text-emerald-300">
                      Conectado
                    </span>
                  ) : status === "conectando" ? (
                    <span className="rounded-full border border-[#1677ff]/30 bg-[#1677ff]/[0.08] px-2.5 py-1 text-[0.68rem] font-semibold text-[#77aaff]">
                      Aguardando leitura do QR Code
                    </span>
                  ) : (
                    <span className="rounded-full border border-[#1677ff]/30 bg-[#1677ff]/[0.08] px-2.5 py-1 text-[0.68rem] font-semibold text-[#77aaff]">
                      Desconectado
                    </span>
                  )}
                </p>
              </div>
            </div>
            {connected ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Tudo certo! Quando um cliente pagar o sinal, ele recebe automaticamente a mensagem
                  de confirmação pelo WhatsApp do seu negócio.
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setConfirmDisconnect(true)}
                  disabled={disconnect.isPending}
                >
                  {disconnect.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Unplug className="size-4" />
                  )}
                  Desconectar WhatsApp
                </Button>
              </>
            ) : qrCode ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Abra o WhatsApp do negócio, toque em{" "}
                  <strong>Aparelhos conectados → Conectar aparelho</strong> e aponte a câmera para o
                  código abaixo.
                </p>
                <div className="flex justify-center rounded-lg border border-border bg-white p-4">
                  <img
                    src={qrCode}
                    alt="QR Code para conectar o WhatsApp do negócio"
                    decoding="async"
                    className="w-64 max-w-full"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    className="integration-dark-button"
                    onClick={() => refreshQr.mutate()}
                    disabled={refreshQr.isPending}
                  >
                    {refreshQr.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    Gerar novo QR Code
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmDisconnect(true)}
                    disabled={disconnect.isPending}
                  >
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Conecte o WhatsApp do seu negócio como um aparelho adicional. Depois disso, toda
                  confirmação de agendamento é enviada automaticamente para o cliente.
                </p>
                <Button
                  className="integration-whatsapp-button"
                  onClick={() => connect.mutate()}
                  disabled={connect.isPending}
                >
                  {connect.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <QrCode className="size-4" />
                  )}
                  Conectar WhatsApp
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="integration-gold-panel p-4 sm:p-5">
          <div className="relative z-10">
            <h2 className="text-base font-semibold text-[#f1f1f3]">Mensagem enviada ao cliente</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              O texto enviado na confirmação usa o modelo configurado na página{" "}
              <strong>Lembretes</strong>, com os campos {"{nome}"}, {"{servico}"}, {"{data}"},{" "}
              {"{hora}"} e {"{negocio}"} preenchidos automaticamente.
            </p>
          </div>
        </div>
      </section>
      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              As mensagens automáticas deixarão de ser enviadas até conectar novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                disconnect.mutate(undefined, { onSettled: () => setConfirmDisconnect(false) });
              }}
              disabled={disconnect.isPending}
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
