import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { businessesQueryKey, syncUpdatedBusiness } from "@/lib/business-cache";

export type Business = {
  id: string;
  name: string;
  slug: string;
  category: string;
  phone: string | null;
  address: string | null;
  status: string;
  monthly_fee_cents: number;
  created_at: string;
  trial_days: number | null;
  trial_created_at: string | null;
  trial_registration_name?: string | null;
  /** Tema de cor do sistema do SaaS por estabelecimento ('azul' | 'rosa' | 'dourado'). */
  theme?: string | null;
  /** Vencimento rolante do acesso (fim do teste ou da assinatura paga). */
  access_until?: string | null;
};

const STORAGE_KEY = "agendaagora:business";

type BusinessState = {
  businesses: Business[];
  business: Business | null;
  businessId: string | null;
  setBusinessId: (id: string) => void;
  loading: boolean;
  refresh: () => void;
  applyUpdatedBusiness: (updated: Partial<Business> & { id: string }) => void;
  canViewCustomerPhone: boolean;
  isPlatformAdmin: boolean;
};

const BusinessContext = createContext<BusinessState>({
  businesses: [],
  business: null,
  businessId: null,
  setBusinessId: () => {},
  loading: true,
  refresh: () => {},
  applyUpdatedBusiness: () => {},
  canViewCustomerPhone: true,
  isPlatformAdmin: false,
});

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [businessIdOverride, setBusinessIdState] = useState<string | null>(null);

  const { data: isPlatformAdmin = false, isSuccess: roleLoaded } = useQuery({
    queryKey: ["current-super-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("user_id", user!.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: businessesQueryKey(user?.id),
    enabled: !!user && roleLoaded && !isPlatformAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, slug, category, phone, address, status, monthly_fee_cents, created_at, trial_days, trial_created_at, trial_registration_name, access_until")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Business[];
    },
  });

  const businesses = useMemo(() => (isPlatformAdmin ? [] : (data ?? [])), [data, isPlatformAdmin]);

  // Resolve o negócio de forma síncrona (sem useEffect) para não exibir
  // "aguardando configuração" por um render após a lista carregar.
  const stored =
    typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
  const businessId = isPlatformAdmin
    ? null
    : businessIdOverride && businesses.some((b) => b.id === businessIdOverride)
      ? businessIdOverride
      : stored && businesses.some((b) => b.id === stored)
        ? stored
        : (businesses[0]?.id ?? null);

  const setBusinessId = (id: string) => {
    if (isPlatformAdmin || !businesses.some((business) => business.id === id)) return;
    window.localStorage.setItem(STORAGE_KEY, id);
    setBusinessIdState(id);
  };

  // Fail-closed: até confirmar a permissão, trata como sem acesso ao telefone do
  // cliente. Dono sempre passa (has_business_permission já cobre owner_id = auth.uid()).
  const { data: canViewCustomerPhone } = useQuery({
    queryKey: ["can-view-customer-phone", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_business_permission", {
        _business_id: businessId!,
        _permission: "view_customer_phone",
      });
      if (error) throw error;
      return !!data;
    },
  });

  // Tema de cor do sistema por estabelecimento (azul | rosa | dourado). Consulta
  // tolerante: enquanto a coluna `theme` não existir no banco (migração pendente),
  // o erro é ignorado em silêncio e vale a preferência local no localStorage.
  const { data: businessTheme } = useQuery({
    queryKey: ["business-theme", businessId],
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("theme")
        .eq("id", businessId!)
        .maybeSingle();
      if (error) return null;
      const t = data?.theme;
      return t === "rosa" || t === "dourado" || t === "azul" ? t : null;
    },
  });

  useEffect(() => {
    if (!businessTheme || typeof document === "undefined") return;
    const root = document.documentElement;
    if (businessTheme === "rosa" || businessTheme === "dourado") {
      root.setAttribute("data-theme", businessTheme);
    } else {
      root.removeAttribute("data-theme");
    }
    window.localStorage.setItem("agendaagora:tema", businessTheme);
  }, [businessTheme]);

  const value: BusinessState = {
    businesses,
    businessId,
    business: businesses.find((b) => b.id === businessId) ?? null,
    setBusinessId,
    loading: isLoading || (!!user && !roleLoaded),
    isPlatformAdmin,
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey: ["businesses"] });
    },
    applyUpdatedBusiness: (updated) => {
      void syncUpdatedBusiness(queryClient, user?.id, updated);
    },
    canViewCustomerPhone: canViewCustomerPhone ?? false,
  };

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  return useContext(BusinessContext);
}
