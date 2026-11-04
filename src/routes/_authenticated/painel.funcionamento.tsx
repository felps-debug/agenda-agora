import { useState } from "react";
import { friendlyError } from "@/lib/error-page";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock3, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { WEEKDAYS, weekdayLabel, hhmm } from "@/lib/format";
import { NoBusiness, EmptyList } from "@/components/painel/PageHeader";
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
      <section className="report-luminous-card report-effect-strong p-4 sm:p-6">
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--c-1677ff)]/35 bg-[var(--c-1677ff)]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--c-6db3ff)]">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-[var(--c-4d9bff)] shadow-[0_0_8px_var(--c-rgba-77-155-255-a0d9)]"
            />
            Funcionamento
          </span>
          <h1 className="mt-2 max-w-2xl font-['Manrope'] text-xl font-black tracking-tight text-white md:text-2xl">
            Funcionamento
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--c-9aa4b2)]">
            Horários fixos que aparecem para o cliente agendar.
          </p>
          <div className="relative mt-4">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-6 top-0 z-10 h-[2.7px] w-16 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,var(--c-0187fc),var(--c-01fbfd))] shadow-[0_0_12px_var(--c-rgba-1-251-253-a0d9),0_0_30px_var(--c-rgba-0-30-252-a0d7)]"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-6 top-0 z-0 h-8 w-16 bg-[radial-gradient(ellipse_at_50%_0%,var(--c-rgba-109-179-255-a0d29),transparent_75%)] blur-[6px]"
            />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="w-full rounded-xl border border-[var(--c-rgba-51-125-255-a0d29)] bg-[var(--c-rgba-22-119-255-a0d09)] text-[var(--c-69a2ff)] shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_0_18px_var(--c-rgba-22-119-255-a0d08)] hover:border-[var(--c-rgba-51-125-255-a0d5)] hover:bg-[var(--c-rgba-22-119-255-a0d14)] hover:text-[var(--c-8fb5ff)] sm:w-auto">
                  <Plus className="size-4" strokeWidth={2.2} /> Cadastrar
                </Button>
              </DialogTrigger>
            <DialogContent className="professional-dialog max-h-[92vh] max-w-lg overflow-y-auto p-0">
              <DialogHeader className="professional-dialog-header">
                <div className="flex items-start gap-3 text-left">
                  <div className="professional-dialog-icon">
                    <Clock3 className="size-[1.05rem]" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[var(--c-f1f2f4)]">
                      Horário de funcionamento
                    </DialogTitle>
                    <p className="mt-1 text-xs leading-relaxed text-[#686b74]">
                      Defina o dia da semana e o intervalo de atendimento.
                    </p>
                  </div>
                </div>
              </DialogHeader>
              <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                <div className="professional-form-section space-y-4">
                  <div className="space-y-2">
                    <Label className="professional-section-label">Dia</Label>
                    <Select
                      value={form.weekday}
                      onValueChange={(weekday) => setForm({ ...form, weekday })}
                    >
                      <SelectTrigger className="professional-input w-full">
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
                      <Label className="professional-section-label" htmlFor="hstart">
                        Começo
                      </Label>
                      <Input
                        id="hstart"
                        type="time"
                        value={form.starts}
                        onChange={(e) => setForm({ ...form, starts: e.target.value })}
                        className="professional-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="professional-section-label" htmlFor="hend">
                        Fim
                      </Label>
                      <Input
                        id="hend"
                        type="time"
                        value={form.ends}
                        onChange={(e) => setForm({ ...form, ends: e.target.value })}
                        className="professional-input"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="professional-dialog-footer">
                <Button
                  className="professional-primary-button"
                  onClick={() => save.mutate()}
                  disabled={save.isPending}
                >
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </section>

      {hoursQuery.isError ? (
        <p role="alert" className="rounded-xl border border-destructive/40 p-6 text-center text-sm">
          Não foi possível carregar os horários de funcionamento. Atualize a página e tente
          novamente.
        </p>
      ) : !hours?.length ? (
        <EmptyList text="Nenhum dia de funcionamento cadastrado." />
      ) : (
        <div className="report-luminous-card report-effect-strong mt-[4.5%] overflow-x-auto">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 z-10 h-[2px] w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-[var(--c-4d9bff)] to-transparent shadow-[0_0_14px_var(--c-rgba-77-155-255-a0d9)]"
          />
          <table className="relative z-10 w-full text-sm">
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
