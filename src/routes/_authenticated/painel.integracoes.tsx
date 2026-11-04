import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-page";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  Loader2,
  MessageSquareText,
  QrCode,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  sendTestMessage,
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
  const navigate = useNavigate();
  const { businessId, businesses } = useBusiness();
  const business = businesses.find((b) => b.id === businessId);
  const queryClient = useQueryClient();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [connectionExpiresAt, setConnectionExpiresAt] = useState<number | null>(null);
  const [connectionMethod, setConnectionMethod] = useState<"qr" | "pairing_code">("qr");
  const [phone, setPhone] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const connectFn = useServerFn(connectWhatsapp);
  const refreshFn = useServerFn(refreshWhatsappQr);
  const statusFn = useServerFn(getWhatsappStatus);
  const disconnectFn = useServerFn(disconnectWhatsapp);
  const sendTestMessageFn = useServerFn(sendTestMessage);

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

  const testMessage = useMutation({
    mutationFn: () =>
      sendTestMessageFn({
        data: {
          businessId: businessId!,
          phone: testPhone,
          template: "Mensagem de teste da Agenda Agora. Seu WhatsApp está conectado.",
        },
      }),
    onSuccess: () => toast.success("Mensagem de teste enviada."),
    onError: (error) => toast.error(friendlyError(error)),
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
            <div className="mb-5 flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => void navigate({ to: "/painel" })}
                aria-label="Voltar ao painel"
                className="flex min-w-0 items-center gap-3 text-left"
              >
                <ArrowLeft className="size-4 shrink-0 text-[#8b8b93]" aria-hidden="true" />
                <span className="integration-gold-icon integration-whatsapp-icon">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="size-[1.05rem]"
                    fill="currentColor"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.198.297-.767.966-.94 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.009-.371-.011-.57-.011-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479s1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.693.625.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.897a9.884 9.884 0 0 1-6.992 16.878m8.413-18.297A11.815 11.815 0 0 0 12.055 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.689 1.448h.005c6.557 0 11.892-5.335 11.895-11.893a11.821 11.821 0 0 0-3.487-8.413Z"></path>
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold tracking-[-0.025em] text-[#f1f1f3]">
                      WhatsApp
                    </span>
                    <span className="rounded-full border border-[#313137] bg-[#17171a] px-2.5 py-1 text-[0.63rem] font-semibold text-[#8a8a92]">
                      Integração externa
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-[#6f7078]">
                    Mensagens, lembretes e conexão do seu número
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-label="Atualizar status"
                onClick={() => void statusQuery.refetch()}
                disabled={statusQuery.isFetching}
                className="integration-gold-icon !size-10 shrink-0 transition hover:border-[var(--c-1677ff)]/60 hover:text-[var(--c-78adff)] disabled:opacity-60"
              >
                <RefreshCw
                  className={`size-4${statusQuery.isFetching ? " animate-spin" : ""}`}
                  aria-hidden="true"
                />
              </button>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {connected ? (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/[0.08] px-2.5 py-1 text-[0.68rem] font-semibold text-emerald-300">
                  Conectado
                </span>
              ) : (
                <span className="rounded-full border border-red-400/30 bg-red-400/[0.08] px-2.5 py-1 text-[0.68rem] font-semibold text-red-300">
                  Desconectado
                </span>
              )}
            </div>
            {connected ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Tudo certo! Quando um cliente pagar o sinal, ele recebe automaticamente a mensagem
                  de confirmação pelo WhatsApp do seu negócio.
                </p>
                <div className="space-y-2 rounded-xl border border-border bg-background/50 p-4">
                  <label className="text-sm font-medium" htmlFor="whatsapp-test-phone">
                    Enviar mensagem de teste para
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="whatsapp-test-phone"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="(98) 99999-0000"
                      value={testPhone}
                      onChange={(event) => setTestPhone(event.target.value)}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => testMessage.mutate()}
                      disabled={testMessage.isPending || testPhone.replace(/\D/g, "").length < 10}
                    >
                      {testMessage.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <MessageSquareText className="size-4" />
                      )}
                      {testMessage.isPending ? "Enviando..." : "Enviar teste"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Uma mensagem de exemplo será enviada para o número informado.
                  </p>
                </div>
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
                <div className="flex flex-wrap gap-2" role="group" aria-label="Método de conexão">
                  <button
                    type="button"
                    onClick={() => setConnectionMethod("qr")}
                    aria-pressed={connectionMethod === "qr"}
                    className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${connectionMethod === "qr" ? "integration-whatsapp-button" : "integration-dark-button"}`}
                  >
                    <QrCode className="size-4" aria-hidden="true" />
                    QR Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setConnectionMethod("pairing_code")}
                    aria-pressed={connectionMethod === "pairing_code"}
                    className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${connectionMethod === "pairing_code" ? "integration-whatsapp-button" : "integration-dark-button"}`}
                  >
                    <KeyRound className="size-4" aria-hidden="true" />
                    123 Código
                  </button>
                </div>
                {connectionMethod === "pairing_code" ? (
                  <div className="space-y-2">
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
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Escaneie o QR Code com a câmera do WhatsApp.
                  </p>
                )}
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
