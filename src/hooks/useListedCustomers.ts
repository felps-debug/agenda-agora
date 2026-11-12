import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mergeAppointmentCustomers, type ListedCustomer } from "@/lib/customer-list";

/**
 * Lista de clientes do negócio, igual à da tela Clientes: cadastros manuais (`customers`)
 * somados a quem já agendou (`appointments`). O agendamento público não cria linha em
 * `customers`, então ler só essa tabela devolvia lista vazia ("Nenhum cliente encontrado")
 * nos seletores de campanha, mensagens pós-atendimento e exceções do sinal.
 */
export function useListedCustomers(businessId: string | null | undefined) {
  return useQuery<ListedCustomer[]>({
    // Chave própria: a tela Clientes usa ["customers", id] com outro formato de dado.
    queryKey: ["listed-customers", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const [customers, visits] = await Promise.all([
        supabase
          .from("customers")
          .select("id, name, phone, email, notes")
          .eq("business_id", businessId!)
          .order("name"),
        supabase
          .from("appointments")
          .select("customer_id, customer_name, customer_phone, starts_at")
          .eq("business_id", businessId!)
          .neq("status", "bloqueado")
          .order("starts_at", { ascending: false }),
      ]);
      if (customers.error) throw customers.error;
      if (visits.error) throw visits.error;
      return mergeAppointmentCustomers(customers.data ?? [], visits.data ?? []);
    },
  });
}
