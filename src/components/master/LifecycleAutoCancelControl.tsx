import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLifecycleAutoCancel, setLifecycleAutoCancel } from "@/lib/lifecycle-settings.functions";
import { toast } from "sonner";

export function LifecycleAutoCancelControl() {
  const client = useQueryClient();
  const getValue = useServerFn(getLifecycleAutoCancel);
  const saveValue = useServerFn(setLifecycleAutoCancel);
  const setting = useQuery({ queryKey: ["lifecycle-auto-cancel"], queryFn: () => getValue() });
  const mutation = useMutation({
    mutationFn: (enabled: boolean) => saveValue({ data: { enabled } }),
    onSuccess: async (result) => {
      toast.success(
        result.enabled ? "Cancelamento automático ativado." : "Cancelamento automático desativado.",
      );
      await client.invalidateQueries({ queryKey: ["lifecycle-auto-cancel"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
      <div className="max-w-3xl">
        <h2 className="text-sm font-semibold text-white">
          Cancelamento por inadimplência no dia 15
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Quando ativado, a rotina diária encerra o acesso de assinantes com 15 dias de atraso. O
          padrão é desativado; confirme com Welison antes de ligar.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-white">
        <input
          type="checkbox"
          checked={setting.data?.enabled ?? false}
          disabled={setting.isLoading || mutation.isPending}
          onChange={(event) => mutation.mutate(event.target.checked)}
        />
        {setting.data?.enabled ? "Ativado" : "Desativado"}
      </label>
    </section>
  );
}
