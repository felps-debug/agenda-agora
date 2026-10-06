import { createFileRoute } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-page";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Loader2, MessageCircle, QrCode, RefreshCw, Unplug } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [connectionExpiresAt, setConnectionExpiresAt] = useState<number | null>(null);
  const [connectionMethod, setConnectionMethod] = useState<"qr" | "pairing_code">("qr");
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const connectFn = useServerFn(connectWhatsapp);
  const refreshFn = useServerFn(refreshWhatsappQr);
  const statusFn = useServerFn(getWhatsappStatus);
  const disconnectFn = useServerFn(disconnectWhatsapp);

  const statusQuery = useQuery({
    queryKey: ["whatsapp-status", businessId],
    queryFn: () => statusFn({ data: { businessId: businessId! } }),
    enabled: !!businessId,
    refetchInterval: (query) =>
      qrCode || pairingCode || query.state.data?.status === "conectando" ? 5_000 : false,
    refetchIntervalInBackground: false,
  });
  const status = statusQuery.data?.status ?? "desconectado";

  const connect = useMutation({
    mutationFn: () =>
      connectFn({
        data: {
          businessId: businessId!,
          method: connectionMethod,
          ...(connectionMethod === "pairing_code" ? { phone } : {}),
        },
      }),
    onSuccess: (data) => {
      setQrCode(data.qrCode);
      setPairingCode(data.pairingCode);
      setConnectionExpiresAt(
        data.qrCode ? Date.now() + 2 * 60_000 : data.pairingCode ? Date.now() + 5 * 60_000 : null,
      );
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
      if (!data.qrCode && !data.pairingCode && !data.alreadyConnected) {
        toast.error(
          connectionMethod === "pairing_code"
            ? "O provedor não devolveu o código de pareamento. Tente gerar novamente ou use QR Code."
            : "O provedor não devolveu o QR Code. Tente gerar novamente.",
        );
      }
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
      setPairingCode(null);
      setConnectionExpiresAt(null);
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
      toast.success("WhatsApp desconectado.");
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  useEffect(() => {
    if (!connectionExpiresAt) return;
    const remaining = connectionExpiresAt - Date.now();
    if (remaining <= 0) {
      setQrCode(null);
      setPairingCode(null);
      setConnectionExpiresAt(null);
      toast.info("O código expirou. Gere um novo para continuar.");
      return;
    }
    const timeout = window.setTimeout(() => {
      setQrCode(null);
      setPairingCode(null);
      setConnectionExpiresAt(null);
      toast.info("O código expirou. Gere um novo para continuar.");
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [connectionExpiresAt]);

  if (!businessId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Integrações" subtitle="Conecte o WhatsApp do seu negócio" />
        <NoBusiness />
      </div>
    );
  }

  const connected = status === "conectado";

  const copyPairingCode = async () => {
    if (!pairingCode) return;
    try {
      await navigator.clipboard.writeText(pairingCode);
      setCopied(true);
      toast.success("Código copiado.");
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o código manualmente.");
    }
  };

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
            ) : qrCode || pairingCode ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Abra o WhatsApp do negócio, toque em{" "}
                  <strong>Aparelhos conectados → Conectar aparelho</strong> e aponte a câmera para o
                  código abaixo.
                </p>
                {pairingCode ? (
                  <div className="rounded-xl border border-border bg-background p-5 text-center">
                    <p className="text-sm text-muted-foreground">
                      No WhatsApp, abra{" "}
                      <strong>Aparelhos conectados → Conectar com número de telefone</strong> e
                      informe este código.
                    </p>
                    <output className="mt-4 block select-all font-mono text-3xl font-bold tracking-[0.2em] text-foreground">
                      {pairingCode}
                    </output>
                    <Button
                      variant="secondary"
                      className="mt-4"
                      onClick={() => void copyPairingCode()}
                    >
                      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                      {copied ? "Copiado" : "Copiar código"}
                    </Button>
                  </div>
                ) : null}
                {qrCode ? (
                  <div className="flex justify-center rounded-lg border border-border bg-white p-4">
                    <img
                      src={qrCode}
                      alt="QR Code para conectar o WhatsApp do negócio"
                      decoding="async"
                      className="w-64 max-w-full"
                    />
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    className="integration-dark-button"
                    onClick={() => (pairingCode ? connect.mutate() : refreshQr.mutate())}
                    disabled={pairingCode ? connect.isPending : refreshQr.isPending}
                  >
                    {refreshQr.isPending || connect.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    {pairingCode ? "Gerar novo código" : "Gerar novo QR Code"}
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
                <Tabs
                  value={connectionMethod}
                  onValueChange={(value) => setConnectionMethod(value as "qr" | "pairing_code")}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="qr">
                      <QrCode className="mr-2 size-4" />
                      QR Code
                    </TabsTrigger>
                    <TabsTrigger value="pairing_code">123 Código</TabsTrigger>
                  </TabsList>
                  <TabsContent value="qr" className="text-sm text-muted-foreground">
                    Escaneie o QR Code com a câmera do WhatsApp.
                  </TabsContent>
                  <TabsContent value="pairing_code" className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="whatsapp-pairing-phone">
                      Número do WhatsApp com DDD
                    </label>
                    <Input
                      id="whatsapp-pairing-phone"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="(98) 99999-0000"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </TabsContent>
                </Tabs>
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
                  {connectionMethod === "qr" ? "Gerar QR Code" : "Gerar código"}
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
