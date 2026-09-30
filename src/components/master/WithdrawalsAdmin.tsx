import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { listAdminWithdrawals, updateAdminWithdrawalStatus } from "@/lib/admin.functions";

type AdminWithdrawal = {
  id: string;
  business_name: string;
  amount_cents: number;
  pix_key_snapshot: string;
  created_at: string;
  status: string;
};

export function WithdrawalsAdmin() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listAdminWithdrawals);
  const updateFn = useServerFn(updateAdminWithdrawalStatus);
  const {
    data: withdrawals = [],
    isLoading,
    isError,
  } = useQuery<AdminWithdrawal[]>({
    queryKey: ["admin-withdrawals"],
    queryFn: () => listFn(),
  });
  const update = useMutation({
    mutationFn: (input: { withdrawalId: string; status: "paid" | "failed" }) =>
      updateFn({ data: input }),
    onSuccess: () => {
      toast.success("Status do saque atualizado.");
      void queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: () => toast.error("Não foi possível atualizar o saque."),
  });

  if (isLoading) return <p className="p-4 text-sm text-muted-foreground">Carregando saques…</p>;
  if (isError)
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        Não foi possível carregar os saques.
      </p>
    );
  if (!withdrawals.length)
    return <p className="p-4 text-sm text-muted-foreground">Nenhum saque registrado.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-3">Negócio</th>
            <th className="p-3">Valor</th>
            <th className="p-3">Chave Pix</th>
            <th className="p-3">Solicitado</th>
            <th className="p-3">Status</th>
            <th className="p-3">Ação manual</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {withdrawals.map((row: AdminWithdrawal) => (
            <tr key={row.id}>
              <td className="p-3 font-medium">{row.business_name}</td>
              <td className="p-3">{formatPrice(row.amount_cents)}</td>
              <td className="max-w-44 truncate p-3">{row.pix_key_snapshot}</td>
              <td className="p-3">{new Date(row.created_at).toLocaleString("pt-BR")}</td>
              <td className="p-3">
                {row.status === "requested"
                  ? "Aguardando"
                  : row.status === "processing"
                    ? "Em processamento"
                    : row.status === "paid"
                      ? "Pago"
                      : "Falhou"}
              </td>
              <td className="p-3">
                {row.status === "processing" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ withdrawalId: row.id, status: "paid" })}
                    >
                      Marcar pago
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ withdrawalId: row.id, status: "failed" })}
                    >
                      Marcar falha
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
