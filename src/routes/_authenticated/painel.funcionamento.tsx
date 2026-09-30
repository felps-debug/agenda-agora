import { useState } from "react";
import { friendlyError } from "@/lib/error-page";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { WEEKDAYS, weekdayLabel, hhmm } from "@/lib/format";
import { PageHeader, NoBusiness, EmptyList } from "@/components/painel/PageHeader";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/painel/funcionamento")({
  head: () => ({
    meta: [
      { title: "Funcionamento — Agenda Agora" },
      { name: "description", content: "Dias e horários fixos de atendimento do seu negócio." },
      { property: "og:title", content: "Funcionamento — Agenda Agora" },
      { property: "og:description", content: "Dias e horários fixos de atendimento." },
    ],
  }),
  component: FuncionamentoPage,
});

function FuncionamentoPage() {
  const { businessId } = useBusiness();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [hoursToRemove, setHoursToRemove] = useState<string | null>(null);
  const [form, setForm] = useState({ weekday: "1", starts: "08:30", ends: "19:00" });

  const hoursQuery = useQuery({
    queryKey: ["business_hours", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_hours")
        .select("*")
        .eq("business_id", businessId!)
        .order("weekday");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["business_hours", businessId] });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("business_hours").upsert(
        {
          business_id: businessId!,
          weekday: Number(form.weekday),
          starts_at: form.starts,
          ends_at: form.ends,
        },
        { onConflict: "business_id,weekday" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Horário salvo!");
      setOpen(false);
      void invalidate();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("business_hours").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });

  if (!businessId) return <NoBusiness />;
  const hours = hoursQuery.data;

  return (
    <div>
      <PageHeader
        title="Funcionamento"
        subtitle="Horários fixos que aparecem para o cliente agendar."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Cadastrar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Horário de funcionamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Dia</Label>
                  <Select
                    value={form.weekday}
                    onValueChange={(weekday) => setForm({ ...form, weekday })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hstart">Começo</Label>
                    <Input
                      id="hstart"
                      type="time"
                      value={form.starts}
                      onChange={(e) => setForm({ ...form, starts: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hend">Fim</Label>
                    <Input
                      id="hend"
                      type="time"
                      value={form.ends}
                      onChange={(e) => setForm({ ...form, ends: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {hoursQuery.isError ? (
        <p role="alert" className="rounded-xl border border-destructive/40 p-6 text-center text-sm">
          Não foi possível carregar os horários de funcionamento. Atualize a página e tente
          novamente.
        </p>
      ) : !hours?.length ? (
        <EmptyList text="Nenhum dia de funcionamento cadastrado." />
      ) : (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Dia</th>
                <th className="px-4 py-3">Começo</th>
                <th className="px-4 py-3">Fim</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {hours.map((h) => (
                <tr key={h.id} className="border-t border-border/60">
                  <td className="px-4 py-3 font-medium">{weekdayLabel(h.weekday)}</td>
                  <td className="px-4 py-3">{hhmm(h.starts_at)}</td>
                  <td className="px-4 py-3">{hhmm(h.ends_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setHoursToRemove(h.id)}
                      aria-label={`Remover ${weekdayLabel(h.weekday)}`}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AlertDialog
        open={hoursToRemove !== null}
        onOpenChange={(open) => !open && setHoursToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover horário de funcionamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esse horário deixará de ser oferecido para novos agendamentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (hoursToRemove)
                  remove.mutate(hoursToRemove, { onSettled: () => setHoursToRemove(null) });
              }}
              disabled={remove.isPending}
            >
              Remover horário
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
