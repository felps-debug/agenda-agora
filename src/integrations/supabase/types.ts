export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          deposit_cents: number
          deposit_paid_at: string | null
          ends_at: string
          id: string
          notes: string | null
          professional_id: string | null
          service_id: string | null
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          deposit_cents?: number
          deposit_paid_at?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          professional_id?: string | null
          service_id?: string | null
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          deposit_cents?: number
          deposit_paid_at?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          professional_id?: string | null
          service_id?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_business_credentials: {
        Row: {
          api_key_encrypted: string
          asaas_account_id: string | null
          business_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          api_key_encrypted: string
          asaas_account_id?: string | null
          business_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string
          asaas_account_id?: string | null
          business_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asaas_business_credentials_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_webhook_events: {
        Row: {
          account_id: string | null
          attempts: number
          available_at: string
          event_id: string
          event_type: string
          id: string
          last_error: string | null
          locked_at: string | null
          payload: Json
          payment_id: string | null
          processed_at: string | null
          received_at: string
          status: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          attempts?: number
          available_at?: string
          event_id: string
          event_type: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          payload: Json
          payment_id?: string | null
          processed_at?: string | null
          received_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          attempts?: number
          available_at?: string
          event_id?: string
          event_type?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
          received_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          business_id: string
          created_at: string
          ends_at: string
          id: string
          starts_at: string
          updated_at: string
          weekday: number
        }
        Insert: {
          business_id: string
          created_at?: string
          ends_at?: string
          id?: string
          starts_at?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          business_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          starts_at?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          asaas_commission_percent: number
          asaas_subaccount_status: string
          asaas_wallet_id: string | null
          brand_background: string | null
          brand_primary: string | null
          category: string
          confirmation_template: string | null
          created_at: string
          id: string
          logo_url: string | null
          monthly_fee_cents: number
          name: string
          owner_id: string
          phone: string | null
          reminder_channel: string
          reminder_enabled: boolean
          reminder_hours_before: number
          reminder_template: string | null
          slug: string
          status: string
          updated_at: string
          whatsapp_instance: string | null
          whatsapp_status: string
          withdrawal_pix_key: string | null
          withdrawal_pix_key_type: string | null
        }
        Insert: {
          address?: string | null
          asaas_commission_percent?: number
          asaas_subaccount_status?: string
          asaas_wallet_id?: string | null
          brand_background?: string | null
          brand_primary?: string | null
          category?: string
          confirmation_template?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          monthly_fee_cents?: number
          name: string
          owner_id?: string
          phone?: string | null
          reminder_channel?: string
          reminder_enabled?: boolean
          reminder_hours_before?: number
          reminder_template?: string | null
          slug: string
          status?: string
          updated_at?: string
          whatsapp_instance?: string | null
          whatsapp_status?: string
          withdrawal_pix_key?: string | null
          withdrawal_pix_key_type?: string | null
        }
        Update: {
          address?: string | null
          asaas_commission_percent?: number
          asaas_subaccount_status?: string
          asaas_wallet_id?: string | null
          brand_background?: string | null
          brand_primary?: string | null
          category?: string
          confirmation_template?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          monthly_fee_cents?: number
          name?: string
          owner_id?: string
          phone?: string | null
          reminder_channel?: string
          reminder_enabled?: boolean
          reminder_hours_before?: number
          reminder_template?: string | null
          slug?: string
          status?: string
          updated_at?: string
          whatsapp_instance?: string | null
          whatsapp_status?: string
          withdrawal_pix_key?: string | null
          withdrawal_pix_key_type?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          business_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_payments: {
        Row: {
          amount_cents: number
          appointment_id: string | null
          asaas_account_id: string | null
          asaas_customer_id: string | null
          business_id: string
          created_at: string
          expires_at: string | null
          id: string
          paid_at: string | null
          payer_cpf_cnpj: string | null
          payer_name: string | null
          payer_phone: string | null
          provider: string
          provider_deleted_at: string | null
          provider_payment_id: string | null
          provider_status: string | null
          qr_code: string | null
          qr_code_base64: string | null
          status: string
          ticket_url: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          appointment_id?: string | null
          asaas_account_id?: string | null
          asaas_customer_id?: string | null
          business_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          payer_cpf_cnpj?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          provider?: string
          provider_deleted_at?: string | null
          provider_payment_id?: string | null
          provider_status?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          status?: string
          ticket_url?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          appointment_id?: string | null
          asaas_account_id?: string | null
          asaas_customer_id?: string | null
          business_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          payer_cpf_cnpj?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          provider?: string
          provider_deleted_at?: string | null
          provider_payment_id?: string | null
          provider_status?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          status?: string
          ticket_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_templates: {
        Row: {
          active: boolean
          body: string
          created_at: string
          created_by: string | null
          id: string
          title: string
          updated_at: string
          usage_type: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
          updated_at?: string
          usage_type: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
          updated_at?: string
          usage_type?: string
        }
        Relationships: []
      }
      professionals: {
        Row: {
          active: boolean
          avatar_path: string | null
          business_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          permissions: Json
          phone: string | null
          role: string | null
          updated_at: string
          user_id: string | null
          working_days: number[]
        }
        Insert: {
          active?: boolean
          avatar_path?: string | null
          business_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          permissions?: Json
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string | null
          working_days?: number[]
        }
        Update: {
          active?: boolean
          avatar_path?: string | null
          business_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          permissions?: Json
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string | null
          working_days?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "professionals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reminder_logs: {
        Row: {
          appointment_id: string
          business_id: string
          channel: string
          created_at: string
          error: string | null
          id: string
          phone: string | null
          provider_sid: string | null
          status: string
        }
        Insert: {
          appointment_id: string
          business_id: string
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          phone?: string | null
          provider_sid?: string | null
          status?: string
        }
        Update: {
          appointment_id?: string
          business_id?: string
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          phone?: string | null
          provider_sid?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      service_professionals: {
        Row: {
          business_id: string
          created_at: string
          professional_id: string
          service_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          professional_id: string
          service_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          professional_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_professionals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_professionals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_professionals_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          deposit_cents: number
          description: string | null
          duration_minutes: number
          id: string
          image_path: string | null
          is_combo: boolean
          name: string
          price_cents: number
          requires_deposit: boolean
          show_duration: boolean
          show_price: boolean
          show_service: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          deposit_cents?: number
          description?: string | null
          duration_minutes?: number
          id?: string
          image_path?: string | null
          is_combo?: boolean
          name: string
          price_cents?: number
          requires_deposit?: boolean
          show_duration?: boolean
          show_price?: boolean
          show_service?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          deposit_cents?: number
          description?: string | null
          duration_minutes?: number
          id?: string
          image_path?: string | null
          is_combo?: boolean
          name?: string
          price_cents?: number
          requires_deposit?: boolean
          show_duration?: boolean
          show_price?: boolean
          show_service?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount_cents: number
          business_id: string
          created_at: string
          id: string
          paid_at: string | null
          reference_month: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          business_id: string
          created_at?: string
          id?: string
          paid_at?: string | null
          reference_month: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          business_id?: string
          created_at?: string
          id?: string
          paid_at?: string | null
          reference_month?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      time_blocks: {
        Row: {
          block_date: string | null
          business_id: string
          created_at: string
          ends_at: string
          id: string
          professional_id: string | null
          reason: string | null
          recurring: boolean
          starts_at: string
          updated_at: string
          weekday: number | null
        }
        Insert: {
          block_date?: string | null
          business_id: string
          created_at?: string
          ends_at: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          recurring?: boolean
          starts_at: string
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          block_date?: string | null
          business_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          recurring?: boolean
          starts_at?: string
          updated_at?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_blocks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_business_permission: {
        Args: { _business_id: string; _permission: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_business_member: { Args: { _business_id: string }; Returns: boolean }
      owns_business: { Args: { _business_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "owner" | "professional"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["super_admin", "owner", "professional"],
    },
  },
} as const
