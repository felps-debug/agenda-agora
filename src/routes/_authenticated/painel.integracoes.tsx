import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircle, QrCode, RefreshCw, Unplug } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const connectFn = useServerFn(connectWhatsapp);
  const refreshFn = useServerFn(refreshWhatsappQr);
  const statusFn = useServerFn(getWhatsappStatus);
  const disconnectFn = useServerFn(disconnectWhatsapp);

  const statusQuery = useQuery({
    queryKey: ["whatsapp-status", businessId],
    queryFn: () => statusFn({ data: { businessId: businessId! } }),
    enabled: !!businessId,
    refetchInterval: 5000,
  });
  const status = statusQuery.data?.status ?? "desconectado";

  const connect = useMutation({
    mutationFn: () => connectFn({ data: { businessId: businessId! } }),
    onSuccess: (data) => {
      setQrCode(data.qrCode);
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
      if (!data.qrCode) toast.info("Instância criada. Gere o QR Code.");
    },
    onError: (e) => toast.error(e.message),
  });

  const refreshQr = useMutation({
    mutationFn: () => refreshFn({ data: { businessId: businessId! } }),
    onSuccess: (data) => {
      if (data.qrCode) setQrCode(data.qrCode);
      else toast.info("QR Code indisponível no momento. Tente de novo.");
    },
    onError: (e) => toast.error(e.message),
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectFn({ data: { businessId: businessId! } }),
    onSuccess: () => {
      setQrCode(null);
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
      toast.success("WhatsApp desconectado.");
    },
    onError: (e) => toast.error(e.message),
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="size-5 text-primary" />
            Status:{" "}
            {statusQuery.isLoading ? (
              <span className="text-muted-foreground">verificando…</span>
            ) : connected ? (
              <span className="text-primary">Conectado</span>
            ) : status === "conectando" ? (
              <span className="text-warning">Aguardando leitura do QR Code</span>
            ) : (
              <span className="text-destructive">Desconectado</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {connected ? (
            <>
              <p className="text-sm text-muted-foreground">
                Tudo certo! Quando um cliente pagar o sinal, ele recebe automaticamente a mensagem
                de confirmação pelo WhatsApp do seu negócio.
              </p>
              <Button
                variant="destructive"
                onClick={() => disconnect.mutate()}
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
                  variant="outline"
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
                  onClick={() => disconnect.mutate()}
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
              <Button onClick={() => connect.mutate()} disabled={connect.isPending}>
                {connect.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <QrCode className="size-4" />
                )}
                Conectar WhatsApp
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mensagem enviada ao cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            O texto enviado na confirmação usa o modelo configurado na página{" "}
            <strong>Lembretes</strong>, com os campos {"{nome}"}, {"{servico}"}, {"{data}"},{" "}
            {"{hora}"} e {"{negocio}"} preenchidos automaticamente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
