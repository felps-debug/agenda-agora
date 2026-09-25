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
  const [businessId, setBusinessIdState] = useState<string | null>(null);

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
        .select("id, name, slug, category, phone, address, status, monthly_fee_cents")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Business[];
    },
  });

  const businesses = useMemo(() => (isPlatformAdmin ? [] : (data ?? [])), [data, isPlatformAdmin]);

  useEffect(() => {
    if (isPlatformAdmin) {
      setBusinessIdState(null);
      return;
    }
    if (!businesses.length) {
      setBusinessIdState(null);
      return;
    }
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    setBusinessIdState((current) => {
      if (current && businesses.some((b) => b.id === current)) return current;
      if (stored && businesses.some((b) => b.id === stored)) return stored;
      return businesses[0]!.id;
    });
  }, [businesses, isPlatformAdmin]);

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
