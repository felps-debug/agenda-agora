import { useState } from "react";
import { friendlyError } from "@/lib/error-page";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarX2, Plus, Repeat2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { WEEKDAYS, weekdayLabel, hhmm, toDateInput } from "@/lib/format";
import { createTimeBlock } from "@/lib/time-blocks.functions";
import { validateTimeBlockRange } from "@/lib/time-blocks";
import { PageHeader, NoBusiness, EmptyList } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/painel/bloqueios")({
  head: () => ({
    meta: [
      { title: "Horários bloqueados — Agenda Agora" },
      { name: "description", content: "Bloqueie horários recorrentes ou de uma data específica." },
      { property: "og:title", content: "Horários bloqueados — Agenda Agora" },
      { property: "og:description", content: "Bloqueios recorrentes e específicos." },
    ],
  }),
  component: BloqueiosPage,
});

function BloqueiosPage() {
  const { businessId } = useBusiness();
  const queryClient = useQueryClient();
  const createTimeBlockFn = useServerFn(createTimeBlock);
  const emptyForm = {
    recurring: true,
    weekday: "1",
    date: toDateInput(new Date()),
    starts: "09:00",
    ends: "09:30",
    reason: "",
  };
  const [open, setOpen] = useState(false);
  const [blockToRemove, setBlockToRemove] = useState<string | null>(null);
  const [showRecurring, setShowRecurring] = useState(true);
  const [showSpecific, setShowSpecific] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const isFormDirty = JSON.stringify(form) !== JSON.stringify(emptyForm);

  const blocksQuery = useQuery({
    queryKey: ["time_blocks", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_blocks")
        .select("*")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["time_blocks", businessId] });
  const timeError = validateTimeBlockRange(form.starts, form.ends);

  const create = useMutation({
    mutationFn: async () =>
      createTimeBlockFn({
        data: {
          businessId: businessId!,
          recurring: form.recurring,
          weekday: form.recurring ? Number(form.weekday) : null,
          blockDate: form.recurring ? null : form.date,
          startsAt: form.starts,
          endsAt: form.ends,
          reason: form.reason || null,
        },
      }),
    onSuccess: () => {
      toast.success("Bloqueio cadastrado!");
      setOpen(false);
      setForm(emptyForm);
      void invalidate();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });

  if (!businessId) return <NoBusiness />;

  const blocks = blocksQuery.data;
  const filtered = (blocks ?? []).filter((b) => (b.recurring ? showRecurring : showSpecific));

  return (
    <div>
      <PageHeader
        title="Horários bloqueados"
        subtitle="Horários que não aparecem para os clientes agendarem."
        action={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              if (v) {
                setOpen(true);
                return;
              }
              if (isFormDirty) {
                setConfirmDiscard(true);
                return;
              }
              setOpen(false);
              setForm(emptyForm);
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Cadastrar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo bloqueio</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="brec"
                    checked={form.recurring}
                    onCheckedChange={(v) => setForm({ ...form, recurring: v === true })}
                  />
                  <Label htmlFor="brec">Repetir toda semana</Label>
                </div>
                {form.recurring ? (
                  <div className="space-y-2">
                    <Label>Dia da semana</Label>
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
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="bdate">Data</Label>
                    <Input
                      id="bdate"
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bstart">Começo</Label>
                    <Input
                      id="bstart"
                      type="time"
                      value={form.starts}
                      onChange={(e) => setForm({ ...form, starts: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bend">Fim</Label>
                    <Input
                      id="bend"
                      type="time"
                      value={form.ends}
                      onChange={(e) => setForm({ ...form, ends: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="breason">Motivo (opcional)</Label>
                  <Input
                    id="breason"
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    placeholder="Almoço, compromisso pessoal..."
                  />
                </div>
              </div>
              {timeError && (
                <p role="alert" className="text-sm text-destructive">
                  {timeError}
                </p>
              )}
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={create.isPending || !!timeError}>
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label
          className={`bloqueio-filter-chip focus-within:ring-2 focus-within:ring-ring ${showRecurring ? "is-selected" : ""}`}
        >
          <Checkbox
            className="sr-only"
            checked={showRecurring}
            onCheckedChange={(v) => setShowRecurring(v === true)}
          />
          <Repeat2 className="size-3.5" />
          Recorrentes
        </label>
        <label
          className={`bloqueio-filter-chip focus-within:ring-2 focus-within:ring-ring ${showSpecific ? "is-selected" : ""}`}
        >
          <Checkbox
            className="sr-only"
            checked={showSpecific}
            onCheckedChange={(v) => setShowSpecific(v === true)}
          />
          <CalendarX2 className="size-3.5" />
          Específicos
        </label>
      </div>

      {blocksQuery.isError ? (
        <p role="alert" className="rounded-xl border border-destructive/40 p-6 text-center text-sm">
          Não foi possível carregar os horários bloqueados. Atualize a página e tente novamente.
        </p>
      ) : !filtered.length ? (
        <EmptyList text="Nenhum horário bloqueado." />
      ) : (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Começo</th>
                <th className="px-4 py-3">Fim</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-t border-border/60">
                  <td className="px-4 py-3 font-medium">
                    {b.recurring
                      ? weekdayLabel(b.weekday ?? 0)
                      : new Date(`${b.block_date}T00:00:00`).toLocaleDateString("pt-BR")}
                    {b.reason && (
                      <span className="ml-2 text-xs text-muted-foreground">{b.reason}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{hhmm(b.starts_at)}</td>
                  <td className="px-4 py-3">{hhmm(b.ends_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setBlockToRemove(b.id)}
                      aria-label="Remover bloqueio"
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
        open={blockToRemove !== null}
        onOpenChange={(value) => !value && setBlockToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover bloqueio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esse horário voltará a ficar disponível para agendamentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (blockToRemove)
                  remove.mutate(blockToRemove, { onSettled: () => setBlockToRemove(null) });
              }}
              disabled={remove.isPending}
            >
              Remover bloqueio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmDiscard} onOpenChange={(v) => !v && setConfirmDiscard(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações não salvas neste formulário. Se sair agora, elas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscard(false);
                setOpen(false);
                setForm(emptyForm);
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
