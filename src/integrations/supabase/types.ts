export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      agpay_webhook_events: {
        Row: {
          attempts: number;
          available_at: string;
          dedupe_hash: string;
          event_type: string;
          id: string;
          last_error: string | null;
          locked_at: string | null;
          payload: Json;
          processed_at: string | null;
          received_at: string;
          status: string;
          transaction_uuid: string | null;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          available_at?: string;
          dedupe_hash: string;
          event_type: string;
          id?: string;
          last_error?: string | null;
          locked_at?: string | null;
          payload: Json;
          processed_at?: string | null;
          received_at?: string;
          status?: string;
          transaction_uuid?: string | null;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          available_at?: string;
          dedupe_hash?: string;
          event_type?: string;
          id?: string;
          last_error?: string | null;
          locked_at?: string | null;
          payload?: Json;
          processed_at?: string | null;
          received_at?: string;
          status?: string;
          transaction_uuid?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      appointments: {
        Row: {
          business_id: string;
          created_at: string;
          customer_id: string | null;
          customer_name: string;
          customer_phone: string | null;
          deposit_cents: number;
          deposit_paid_at: string | null;
          ends_at: string;
          id: string;
          notes: string | null;
          professional_id: string | null;
          public_code: string;
          service_id: string | null;
          starts_at: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          customer_id?: string | null;
          customer_name: string;
          customer_phone?: string | null;
          deposit_cents?: number;
          deposit_paid_at?: string | null;
          ends_at: string;
          id?: string;
          notes?: string | null;
          professional_id?: string | null;
          public_code?: string;
          service_id?: string | null;
          starts_at: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          customer_id?: string | null;
          customer_name?: string;
          customer_phone?: string | null;
          deposit_cents?: number;
          deposit_paid_at?: string | null;
          ends_at?: string;
          id?: string;
          notes?: string | null;
          professional_id?: string | null;
          public_code?: string;
          service_id?: string | null;
          starts_at?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_professional_id_fkey";
            columns: ["professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      asaas_webhook_events: {
        Row: {
          account_id: string | null;
          attempts: number;
          available_at: string;
          event_id: string;
          event_type: string;
          id: string;
          last_error: string | null;
          locked_at: string | null;
          payload: Json;
          payment_id: string | null;
          processed_at: string | null;
          received_at: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          account_id?: string | null;
          attempts?: number;
          available_at?: string;
          event_id: string;
          event_type: string;
          id?: string;
          last_error?: string | null;
          locked_at?: string | null;
          payload: Json;
          payment_id?: string | null;
          processed_at?: string | null;
          received_at?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string | null;
          attempts?: number;
          available_at?: string;
          event_id?: string;
          event_type?: string;
          id?: string;
          last_error?: string | null;
          locked_at?: string | null;
          payload?: Json;
          payment_id?: string | null;
          processed_at?: string | null;
          received_at?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      business_hours: {
        Row: {
          business_id: string;
          created_at: string;
          ends_at: string;
          id: string;
          starts_at: string;
          updated_at: string;
          weekday: number;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          ends_at?: string;
          id?: string;
          starts_at?: string;
          updated_at?: string;
          weekday: number;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          ends_at?: string;
          id?: string;
          starts_at?: string;
          updated_at?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      business_outreach_overrides: {
        Row: {
          business_id: string;
          design: Json;
          id: string;
          template_id: string;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          design: Json;
          id?: string;
          template_id: string;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          design?: Json;
          id?: string;
          template_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_outreach_overrides_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_outreach_overrides_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "outreach_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      businesses: {
        Row: {
          address: string | null;
          agpay_commission_percent: number;
          agpay_split_email: string | null;
          agpay_split_status: string;
          brand_background: string | null;
          brand_background_image: string | null;
          brand_primary: string | null;
          category: string;
          confirmation_template: string | null;
          created_at: string;
          greeting: string | null;
          id: string;
          logo_url: string | null;
          monthly_fee_cents: number;
          name: string;
          owner_id: string;
          payment_confirmation_template: string | null;
          phone: string | null;
          reminder_channel: string;
          reminder_enabled: boolean;
          reminder_hours_before: number;
          reminder_template: string | null;
          selected_outreach_template_ids: string[];
          slug: string;
          status: string;
          timezone: string;
          updated_at: string;
          whatsapp_instance: string | null;
          whatsapp_instance_id: string | null;
          whatsapp_instance_token: string | null;
          whatsapp_status: string;
          withdrawal_pix_key: string | null;
          withdrawal_pix_key_type: string | null;
        };
        Insert: {
          address?: string | null;
          agpay_commission_percent?: number;
          agpay_split_email?: string | null;
          agpay_split_status?: string;
          brand_background?: string | null;
          brand_background_image?: string | null;
          brand_primary?: string | null;
          category?: string;
          confirmation_template?: string | null;
          created_at?: string;
          greeting?: string | null;
          id?: string;
          logo_url?: string | null;
          monthly_fee_cents?: number;
          name: string;
          owner_id?: string;
          payment_confirmation_template?: string | null;
          phone?: string | null;
          reminder_channel?: string;
          reminder_enabled?: boolean;
          reminder_hours_before?: number;
          reminder_template?: string | null;
          selected_outreach_template_ids?: string[];
          slug: string;
          status?: string;
          timezone?: string;
          updated_at?: string;
          whatsapp_instance?: string | null;
          whatsapp_instance_id?: string | null;
          whatsapp_instance_token?: string | null;
          whatsapp_status?: string;
          withdrawal_pix_key?: string | null;
          withdrawal_pix_key_type?: string | null;
        };
        Update: {
          address?: string | null;
          agpay_commission_percent?: number;
          agpay_split_email?: string | null;
          agpay_split_status?: string;
          brand_background?: string | null;
          brand_background_image?: string | null;
          brand_primary?: string | null;
          category?: string;
          confirmation_template?: string | null;
          created_at?: string;
          greeting?: string | null;
          id?: string;
          logo_url?: string | null;
          monthly_fee_cents?: number;
          name?: string;
          owner_id?: string;
          payment_confirmation_template?: string | null;
          phone?: string | null;
          reminder_channel?: string;
          reminder_enabled?: boolean;
          reminder_hours_before?: number;
          reminder_template?: string | null;
          selected_outreach_template_ids?: string[];
          slug?: string;
          status?: string;
          timezone?: string;
          updated_at?: string;
          whatsapp_instance?: string | null;
          whatsapp_instance_id?: string | null;
          whatsapp_instance_token?: string | null;
          whatsapp_status?: string;
          withdrawal_pix_key?: string | null;
          withdrawal_pix_key_type?: string | null;
        };
        Relationships: [];
      };
      business_visual_settings: {
        Row: {
          appearance: Json;
          business_id: string;
          content: Json;
          created_at: string;
          layout_key: "classic" | "liquid_glass";
          niche_id: string;
          palette_id: string | null;
          revision: number;
          schema_version: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          appearance?: Json;
          business_id: string;
          content?: Json;
          layout_key?: "classic" | "liquid_glass";
          niche_id?: string;
          palette_id?: string | null;
          revision?: number;
          schema_version?: number;
          updated_by?: string | null;
        };
        Update: {
          appearance?: Json;
          content?: Json;
          layout_key?: "classic" | "liquid_glass";
          niche_id?: string;
          palette_id?: string | null;
          revision?: number;
          schema_version?: number;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      business_whatsapp_credentials: {
        Row: {
          business_id: string;
          created_at: string;
          instance_id: string;
          instance_token: string;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          instance_id: string;
          instance_token: string;
        };
        Update: {
          instance_id?: string;
          instance_token?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          business_id: string;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      deposit_payments: {
        Row: {
          amount_cents: number;
          appointment_id: string | null;
          business_id: string;
          created_at: string;
          expires_at: string | null;
          gateway_fee_cents: number | null;
          id: string;
          net_amount_cents: number | null;
          paid_at: string | null;
          payer_cpf_cnpj: string | null;
          payer_email: string | null;
          payer_name: string | null;
          payer_phone: string | null;
          pix_attempt_state: string;
          pix_attempts: number;
          pix_claim_expires_at: string | null;
          pix_claim_token: string | null;
          pix_post_started_at: string | null;
          platform_commission_cents: number | null;
          platform_commission_flat_cents: number | null;
          platform_commission_percent_snapshot: number | null;
          provider: string;
          provider_deleted_at: string | null;
          provider_payment_id: string | null;
          provider_status: string | null;
          qr_code: string | null;
          qr_code_base64: string | null;
          status: string;
          ticket_url: string | null;
          updated_at: string;
        };
        Insert: {
          amount_cents?: number;
          appointment_id?: string | null;
          business_id: string;
          created_at?: string;
          expires_at?: string | null;
          gateway_fee_cents?: number | null;
          id?: string;
          net_amount_cents?: number | null;
          paid_at?: string | null;
          payer_cpf_cnpj?: string | null;
          payer_email?: string | null;
          payer_name?: string | null;
          payer_phone?: string | null;
          pix_attempt_state?: string;
          pix_attempts?: number;
          pix_claim_expires_at?: string | null;
          pix_claim_token?: string | null;
          pix_post_started_at?: string | null;
          platform_commission_cents?: number | null;
          platform_commission_flat_cents?: number | null;
          platform_commission_percent_snapshot?: number | null;
          provider?: string;
          provider_deleted_at?: string | null;
          provider_payment_id?: string | null;
          provider_status?: string | null;
          qr_code?: string | null;
          qr_code_base64?: string | null;
          status?: string;
          ticket_url?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          appointment_id?: string | null;
          business_id?: string;
          created_at?: string;
          expires_at?: string | null;
          gateway_fee_cents?: number | null;
          id?: string;
          net_amount_cents?: number | null;
          paid_at?: string | null;
          payer_cpf_cnpj?: string | null;
          payer_email?: string | null;
          payer_name?: string | null;
          payer_phone?: string | null;
          pix_attempt_state?: string;
          pix_attempts?: number;
          pix_claim_expires_at?: string | null;
          pix_claim_token?: string | null;
          pix_post_started_at?: string | null;
          platform_commission_cents?: number | null;
          platform_commission_flat_cents?: number | null;
          platform_commission_percent_snapshot?: number | null;
          provider?: string;
          provider_deleted_at?: string | null;
          provider_payment_id?: string | null;
          provider_status?: string | null;
          qr_code?: string | null;
          qr_code_base64?: string | null;
          status?: string;
          ticket_url?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deposit_payments_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deposit_payments_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_entries: {
        Row: {
          amount_cents: number;
          business_id: string;
          created_at: string;
          description: string | null;
          id: string;
          idempotency_key: string;
          metadata: Json;
          payment_id: string | null;
          status: string;
          type: string;
          withdrawal_id: string | null;
        };
        Insert: {
          amount_cents: number;
          business_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          idempotency_key: string;
          metadata?: Json;
          payment_id?: string | null;
          status?: string;
          type: string;
          withdrawal_id?: string | null;
        };
        Update: {
          amount_cents?: number;
          business_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          idempotency_key?: string;
          metadata?: Json;
          payment_id?: string | null;
          status?: string;
          type?: string;
          withdrawal_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_entries_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "deposit_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_withdrawal_id_fkey";
            columns: ["withdrawal_id"];
            isOneToOne: false;
            referencedRelation: "withdrawals";
            referencedColumns: ["id"];
          },
        ];
      };
      outreach_templates: {
        Row: {
          active: boolean;
          body: string;
          created_at: string;
          created_by: string | null;
          design: Json;
          id: string;
          is_default: boolean;
          title: string;
          updated_at: string;
          usage_type: string;
        };
        Insert: {
          active?: boolean;
          body: string;
          created_at?: string;
          created_by?: string | null;
          design?: Json;
          id?: string;
          is_default?: boolean;
          title: string;
          updated_at?: string;
          usage_type: string;
        };
        Update: {
          active?: boolean;
          body?: string;
          created_at?: string;
          created_by?: string | null;
          design?: Json;
          id?: string;
          is_default?: boolean;
          title?: string;
          updated_at?: string;
          usage_type?: string;
        };
        Relationships: [];
      };
      professionals: {
        Row: {
          active: boolean;
          avatar_path: string | null;
          business_id: string;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          permissions: Json;
          phone: string | null;
          role: string | null;
          updated_at: string;
          user_id: string | null;
          working_days: number[];
        };
        Insert: {
          active?: boolean;
          avatar_path?: string | null;
          business_id: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          permissions?: Json;
          phone?: string | null;
          role?: string | null;
          updated_at?: string;
          user_id?: string | null;
          working_days?: number[];
        };
        Update: {
          active?: boolean;
          avatar_path?: string | null;
          business_id?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          permissions?: Json;
          phone?: string | null;
          role?: string | null;
          updated_at?: string;
          user_id?: string | null;
          working_days?: number[];
        };
        Relationships: [
          {
            foreignKeyName: "professionals_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reminder_logs: {
        Row: {
          appointment_id: string;
          business_id: string;
          channel: string;
          created_at: string;
          error: string | null;
          id: string;
          phone: string | null;
          provider_sid: string | null;
          status: string;
        };
        Insert: {
          appointment_id: string;
          business_id: string;
          channel?: string;
          created_at?: string;
          error?: string | null;
          id?: string;
          phone?: string | null;
          provider_sid?: string | null;
          status?: string;
        };
        Update: {
          appointment_id?: string;
          business_id?: string;
          channel?: string;
          created_at?: string;
          error?: string | null;
          id?: string;
          phone?: string | null;
          provider_sid?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_logs_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reminder_logs_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      service_professionals: {
        Row: {
          business_id: string;
          created_at: string;
          professional_id: string;
          service_id: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          professional_id: string;
          service_id: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          professional_id?: string;
          service_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_professionals_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_professionals_professional_id_fkey";
            columns: ["professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_professionals_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          active: boolean;
          business_id: string;
          created_at: string;
          deposit_cents: number;
          deposit_mode: string;
          deposit_percent_bps: number;
          description: string | null;
          duration_minutes: number;
          id: string;
          image_path: string | null;
          is_combo: boolean;
          name: string;
          price_cents: number;
          requires_deposit: boolean;
          show_duration: boolean;
          show_price: boolean;
          show_service: boolean;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          business_id: string;
          created_at?: string;
          deposit_cents?: number;
          deposit_mode?: string;
          deposit_percent_bps?: number;
          description?: string | null;
          duration_minutes?: number;
          id?: string;
          image_path?: string | null;
          is_combo?: boolean;
          name: string;
          price_cents?: number;
          requires_deposit?: boolean;
          show_duration?: boolean;
          show_price?: boolean;
          show_service?: boolean;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          business_id?: string;
          created_at?: string;
          deposit_cents?: number;
          deposit_mode?: string;
          deposit_percent_bps?: number;
          description?: string | null;
          duration_minutes?: number;
          id?: string;
          image_path?: string | null;
          is_combo?: boolean;
          name?: string;
          price_cents?: number;
          requires_deposit?: boolean;
          show_duration?: boolean;
          show_price?: boolean;
          show_service?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_payments: {
        Row: {
          amount_cents: number;
          business_id: string;
          created_at: string;
          id: string;
          paid_at: string | null;
          reference_month: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount_cents?: number;
          business_id: string;
          created_at?: string;
          id?: string;
          paid_at?: string | null;
          reference_month: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          business_id?: string;
          created_at?: string;
          id?: string;
          paid_at?: string | null;
          reference_month?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_payments_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      time_blocks: {
        Row: {
          block_date: string | null;
          business_id: string;
          created_at: string;
          ends_at: string;
          id: string;
          professional_id: string | null;
          reason: string | null;
          recurring: boolean;
          starts_at: string;
          updated_at: string;
          weekday: number | null;
        };
        Insert: {
          block_date?: string | null;
          business_id: string;
          created_at?: string;
          ends_at: string;
          id?: string;
          professional_id?: string | null;
          reason?: string | null;
          recurring?: boolean;
          starts_at: string;
          updated_at?: string;
          weekday?: number | null;
        };
        Update: {
          block_date?: string | null;
          business_id?: string;
          created_at?: string;
          ends_at?: string;
          id?: string;
          professional_id?: string | null;
          reason?: string | null;
          recurring?: boolean;
          starts_at?: string;
          updated_at?: string;
          weekday?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "time_blocks_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_blocks_professional_id_fkey";
            columns: ["professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      wallets: {
        Row: {
          available_cents: number;
          business_id: string;
          locked_cents: number;
          pending_cents: number;
          updated_at: string;
        };
        Insert: {
          available_cents?: number;
          business_id: string;
          locked_cents?: number;
          pending_cents?: number;
          updated_at?: string;
        };
        Update: {
          available_cents?: number;
          business_id?: string;
          locked_cents?: number;
          pending_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wallets_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      withdrawals: {
        Row: {
          amount_cents: number;
          business_id: string;
          created_at: string;
          id: string;
          idempotency_key: string;
          pix_key_snapshot: string;
          provider_fee_cents: number | null;
          platform_fee_cents: number;
          provider_ref: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          business_id: string;
          created_at?: string;
          id?: string;
          idempotency_key: string;
          pix_key_snapshot: string;
          provider_fee_cents?: number | null;
          platform_fee_cents?: number;
          provider_ref?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          business_id?: string;
          created_at?: string;
          id?: string;
          idempotency_key?: string;
          pix_key_snapshot?: string;
          provider_fee_cents?: number | null;
          platform_fee_cents?: number;
          provider_ref?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "withdrawals_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      business_logos_image_business_id: {
        Args: { _name: string };
        Returns: string;
      };
      claim_deposit_pix: {
        Args: { _charge_id: string; _lease_seconds?: number };
        Returns: {
          acquired: boolean;
          attempt_state: string;
          claim_token: string;
          lease_expires_at: string;
          reason: string;
        }[];
      };
      has_business_permission: {
        Args: { _business_id: string; _permission: string };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_business_member: { Args: { _business_id: string }; Returns: boolean };
      ledger_adjustment: {
        Args: {
          _amount_cents: number;
          _business_id: string;
          _description: string;
          _idempotency_key: string;
        };
        Returns: {
          created: boolean;
          entry_id: string;
        }[];
      };
      ledger_credit_payment: {
        Args: {
          _amount_cents: number;
          _business_id: string;
          _description: string;
          _idempotency_key: string;
          _metadata?: Json;
          _payment_id: string;
        };
        Returns: {
          created: boolean;
          entry_id: string;
        }[];
      };
      ledger_debit_refund: {
        Args: {
          _amount_cents: number;
          _business_id: string;
          _description: string;
          _idempotency_key: string;
          _payment_id: string;
        };
        Returns: {
          created: boolean;
          entry_id: string;
        }[];
      };
      ledger_request_withdrawal: {
        Args: {
          _amount_cents: number;
          _business_id: string;
          _idempotency_key: string;
          _withdrawal_id: string;
        };
        Returns: {
          accepted: boolean;
          available_cents: number;
          entry_id: string;
        }[];
      };
      ledger_reverse_withdrawal: {
        Args: {
          _amount_cents: number;
          _business_id: string;
          _idempotency_key: string;
          _withdrawal_id: string;
        };
        Returns: {
          created: boolean;
          entry_id: string;
        }[];
      };
      mark_deposit_pix_post_started: {
        Args: {
          _charge_id: string;
          _claim_token: string;
          _lease_seconds?: number;
        };
        Returns: boolean;
      };
      owns_business: { Args: { _business_id: string }; Returns: boolean };
      release_deposit_pix: {
        Args: { _charge_id: string; _claim_token: string; _outcome: string };
        Returns: boolean;
      };
      replace_professional_services: {
        Args: {
          _business_id: string;
          _professional_id: string;
          _service_ids: string[];
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "super_admin" | "owner" | "professional";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "owner", "professional"],
    },
  },
} as const;
