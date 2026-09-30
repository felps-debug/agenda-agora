import { useState } from "react";
import { friendlyError } from "@/lib/error-page";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Search, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { daysSince } from "@/lib/format";
import { mergeAppointmentCustomers } from "@/lib/customer-list";
import { PageHeader, NoBusiness, EmptyList } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/painel/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Agenda Agora" },
      { name: "description", content: "Cadastro de clientes com contato e observações." },
      { property: "og:title", content: "Clientes — Agenda Agora" },
      { property: "og:description", content: "Cadastro de clientes com contato e observações." },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  const { businessId, canViewCustomerPhone } = useBusiness();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [customerToRemove, setCustomerToRemove] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });

  const customersQuery = useQuery({
    queryKey: ["customers", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("business_id", businessId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const visitsQuery = useQuery({
    queryKey: ["customer-visits", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("customer_id, customer_name, customer_phone, starts_at")
        .eq("business_id", businessId!)
        .neq("status", "bloqueado")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const customers = mergeAppointmentCustomers(customersQuery.data ?? [], visitsQuery.data ?? []);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["customers", businessId] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customers").insert({
        business_id: businessId!,
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente cadastrado!");
      setOpen(false);
      setForm({ name: "", phone: "", email: "", notes: "" });
      void invalidate();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente removido.");
      void invalidate();
    },
  });

  if (!businessId) return <NoBusiness />;

  const filtered = customers.filter((c) =>
    `${c.name} ${c.phone ?? ""}`.toLowerCase().includes(term.toLowerCase()),
  );

  const exportCsv = () => {
    const rows = filtered.map((c) => [
      c.name,
      canViewCustomerPhone ? (c.phone ?? "") : "",
      c.email ?? "",
      c.lastAppointmentAt ? new Date(c.lastAppointmentAt).toLocaleDateString("pt-BR") : "",
      (c.notes ?? "").replace(/\s+/g, " "),
    ]);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [["Nome", "Telefone", "E-mail", "Último atendimento", "Observações"], ...rows]
      .map((r) => r.map((cell) => escape(String(cell))).join(";"))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Lista de clientes exportada");
  };

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Histórico e contato de quem atende com você."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="size-4" /> Exportar
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" /> Novo cliente
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo cliente</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cname">Nome</Label>
                    <Input
                      id="cname"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cphone">Telefone</Label>
                      <Input
                        id="cphone"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cmail">E-mail</Label>
                      <Input
                        id="cmail"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnotes">Observações</Label>
                    <Textarea
                      id="cnotes"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Preferências, alergias, histórico..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => create.mutate()}
                    disabled={!form.name.trim() || create.isPending}
                  >
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar cliente pelo nome"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      {visitsQuery.isError && (
        <p role="alert" className="mb-4 rounded-xl border border-destructive/40 p-4 text-sm">
          Não foi possível carregar o histórico de visitas; os dias ausente podem estar incompletos.
        </p>
      )}

      {customersQuery.isError || visitsQuery.isError ? (
        <p role="alert" className="rounded-xl border border-destructive/40 p-6 text-center text-sm">
          Não foi possível carregar os clientes. Atualize a página e tente novamente.
        </p>
      ) : !filtered.length ? (
        <EmptyList text="Nenhum cliente encontrado." />
      ) : (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Dias ausente</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const last = c.lastAppointmentAt;
                const days = last === undefined ? null : daysSince(last);
                return (
                  <tr key={c.id} className="border-t border-border/60">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-primary">
                      {canViewCustomerPhone ? (c.phone ?? "—") : "•••••••••"}
                    </td>
                    <td className="px-4 py-3">{days === null ? "—" : `${days} dias`}</td>
                    <td className="px-4 py-3 text-right">
                      {c.manual && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCustomerToRemove(c.id)}
                          aria-label={`Remover ${c.name}`}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="border-t border-border/60 px-4 py-3 text-center text-sm text-muted-foreground">
            Total de clientes: <span className="text-primary">{filtered.length}</span>
          </p>
        </div>
      )}
      <AlertDialog
        open={customerToRemove !== null}
        onOpenChange={(open) => !open && setCustomerToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              O cadastro manual será excluído. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (customerToRemove)
                  remove.mutate(customerToRemove, { onSettled: () => setCustomerToRemove(null) });
              }}
              disabled={remove.isPending}
            >
              Remover cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
