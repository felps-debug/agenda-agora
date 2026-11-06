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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      agpay_webhook_events: {
        Row: {
          attempts: number
          available_at: string
          dedupe_hash: string
          event_type: string
          id: string
          last_error: string | null
          locked_at: string | null
          payload: Json
          processed_at: string | null
          received_at: string
          status: string
          transaction_uuid: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          dedupe_hash: string
          event_type: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          payload: Json
          processed_at?: string | null
          received_at?: string
          status?: string
          transaction_uuid?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          dedupe_hash?: string
          event_type?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          payload?: Json
          processed_at?: string | null
          received_at?: string
          status?: string
          transaction_uuid?: string | null
          updated_at?: string
        }
        Relationships: []
      }
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
          public_code: string
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
          public_code?: string
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
          public_code?: string
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
      auth_attempts: {
        Row: {
          failures: number
          key: string
          locked_until: string | null
          updated_at: string
          window_started_at: string
        }
        Insert: {
          failures?: number
          key: string
          locked_until?: string | null
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          failures?: number
          key?: string
          locked_until?: string | null
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      broadcasts: {
        Row: {
          accent_color: string | null
          audiences: string[] | null
          created_at: string
          display_days: number | null
          icon: string | null
          id: string
          message: string
          title: string
        }
        Insert: {
          accent_color?: string | null
          audiences?: string[] | null
          created_at?: string
          display_days?: number | null
          icon?: string | null
          id?: string
          message: string
          title: string
        }
        Update: {
          accent_color?: string | null
          audiences?: string[] | null
          created_at?: string
          display_days?: number | null
          icon?: string | null
          id?: string
          message?: string
          title?: string
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
      business_outreach_overrides: {
        Row: {
          business_id: string
          design: Json
          id: string
          template_id: string
          updated_at: string
        }
        Insert: {
          business_id: string
          design: Json
          id?: string
          template_id: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          design?: Json
          id?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_outreach_overrides_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_outreach_overrides_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "outreach_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      business_visual_settings: {
        Row: {
          appearance: Json
          business_id: string
          content: Json
          created_at: string
          layout_key: string
          niche_id: string
          palette_id: string | null
          revision: number
          schema_version: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          appearance?: Json
          business_id: string
          content?: Json
          created_at?: string
          layout_key?: string
          niche_id?: string
          palette_id?: string | null
          revision?: number
          schema_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          appearance?: Json
          business_id?: string
          content?: Json
          created_at?: string
          layout_key?: string
          niche_id?: string
          palette_id?: string | null
          revision?: number
          schema_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_visual_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_whatsapp_credentials: {
        Row: {
          business_id: string
          created_at: string
          instance_id: string
          instance_token: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          instance_id: string
          instance_token: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          instance_id?: string
          instance_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_whatsapp_credentials_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          access_until: string | null
          address: string | null
          agpay_access_blocked: boolean
          agpay_auto_first_key: boolean
          agpay_commission_percent: number
          agpay_split_email: string | null
          agpay_split_status: string
          agpay_withdrawal_blocked: boolean
          brand_background: string | null
          brand_background_image: string | null
          brand_primary: string | null
          cancel_requested_at: string | null
          cancelled_at: string | null
          category: string
          commercial_notes: string | null
          confirmation_template: string | null
          coupon_code: string | null
          coupon_expires_at: string | null
          coupon_percent: number | null
          created_at: string
          greeting: string | null
          id: string
          lead_source: string | null
          logo_url: string | null
          monthly_fee_cents: number
          name: string
          owner_cpf: string | null
          owner_id: string
          payment_confirmation_template: string | null
          phone: string | null
          pix_exception_clients: string[]
          pix_mode: string
          reminder_channel: string
          reminder_enabled: boolean
          reminder_hours_before: number
          reminder_template: string | null
          sales_owner: string | null
          saudacao_template: string | null
          sdr_id: string | null
          selected_outreach_template_ids: string[]
          slug: string
          status: string
          theme: string | null
          timezone: string
          trial_created_at: string | null
          trial_days: number | null
          trial_registration_name: string | null
          updated_at: string
          whatsapp_instance: string | null
          whatsapp_instance_id: string | null
          whatsapp_instance_token: string | null
          whatsapp_status: string
          withdrawal_pin_hash: string | null
          withdrawal_pix_key: string | null
          withdrawal_pix_key_type: string | null
        }
        Insert: {
          access_until?: string | null
          address?: string | null
          agpay_access_blocked?: boolean
          agpay_auto_first_key?: boolean
          agpay_commission_percent?: number
          agpay_split_email?: string | null
          agpay_split_status?: string
          agpay_withdrawal_blocked?: boolean
          brand_background?: string | null
          brand_background_image?: string | null
          brand_primary?: string | null
          cancel_requested_at?: string | null
          cancelled_at?: string | null
          category?: string
          commercial_notes?: string | null
          confirmation_template?: string | null
          coupon_code?: string | null
          coupon_expires_at?: string | null
          coupon_percent?: number | null
          created_at?: string
          greeting?: string | null
          id?: string
          lead_source?: string | null
          logo_url?: string | null
          monthly_fee_cents?: number
          name: string
          owner_cpf?: string | null
          owner_id?: string
          payment_confirmation_template?: string | null
          phone?: string | null
          pix_exception_clients?: string[]
          pix_mode?: string
          reminder_channel?: string
          reminder_enabled?: boolean
          reminder_hours_before?: number
          reminder_template?: string | null
          sales_owner?: string | null
          saudacao_template?: string | null
          sdr_id?: string | null
          selected_outreach_template_ids?: string[]
          slug: string
          status?: string
          theme?: string | null
          timezone?: string
          trial_created_at?: string | null
          trial_days?: number | null
          trial_registration_name?: string | null
          updated_at?: string
          whatsapp_instance?: string | null
          whatsapp_instance_id?: string | null
          whatsapp_instance_token?: string | null
          whatsapp_status?: string
          withdrawal_pin_hash?: string | null
          withdrawal_pix_key?: string | null
          withdrawal_pix_key_type?: string | null
        }
        Update: {
          access_until?: string | null
          address?: string | null
          agpay_access_blocked?: boolean
          agpay_auto_first_key?: boolean
          agpay_commission_percent?: number
          agpay_split_email?: string | null
          agpay_split_status?: string
          agpay_withdrawal_blocked?: boolean
          brand_background?: string | null
          brand_background_image?: string | null
          brand_primary?: string | null
          cancel_requested_at?: string | null
          cancelled_at?: string | null
          category?: string
          commercial_notes?: string | null
          confirmation_template?: string | null
          coupon_code?: string | null
          coupon_expires_at?: string | null
          coupon_percent?: number | null
          created_at?: string
          greeting?: string | null
          id?: string
          lead_source?: string | null
          logo_url?: string | null
          monthly_fee_cents?: number
          name?: string
          owner_cpf?: string | null
          owner_id?: string
          payment_confirmation_template?: string | null
          phone?: string | null
          pix_exception_clients?: string[]
          pix_mode?: string
          reminder_channel?: string
          reminder_enabled?: boolean
          reminder_hours_before?: number
          reminder_template?: string | null
          sales_owner?: string | null
          saudacao_template?: string | null
          sdr_id?: string | null
          selected_outreach_template_ids?: string[]
          slug?: string
          status?: string
          theme?: string | null
          timezone?: string
          trial_created_at?: string | null
          trial_days?: number | null
          trial_registration_name?: string | null
          updated_at?: string
          whatsapp_instance?: string | null
          whatsapp_instance_id?: string | null
          whatsapp_instance_token?: string | null
          whatsapp_status?: string
          withdrawal_pin_hash?: string | null
          withdrawal_pix_key?: string | null
          withdrawal_pix_key_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "sdrs"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          birth_date: string | null
          business_id: string
          cnpj: string | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          business_id: string
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          business_id?: string
          cnpj?: string | null
          cpf?: string | null
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
          business_id: string
          created_at: string
          expires_at: string | null
          gateway_fee_cents: number | null
          id: string
          net_amount_cents: number | null
          paid_at: string | null
          payer_cpf_cnpj: string | null
          payer_email: string | null
          payer_name: string | null
          payer_phone: string | null
          pix_attempt_state: string
          pix_attempts: number
          pix_claim_expires_at: string | null
          pix_claim_token: string | null
          pix_post_started_at: string | null
          platform_commission_cents: number | null
          platform_commission_flat_cents: number | null
          platform_commission_percent_snapshot: number | null
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
          business_id: string
          created_at?: string
          expires_at?: string | null
          gateway_fee_cents?: number | null
          id?: string
          net_amount_cents?: number | null
          paid_at?: string | null
          payer_cpf_cnpj?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          pix_attempt_state?: string
          pix_attempts?: number
          pix_claim_expires_at?: string | null
          pix_claim_token?: string | null
          pix_post_started_at?: string | null
          platform_commission_cents?: number | null
          platform_commission_flat_cents?: number | null
          platform_commission_percent_snapshot?: number | null
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
          business_id?: string
          created_at?: string
          expires_at?: string | null
          gateway_fee_cents?: number | null
          id?: string
          net_amount_cents?: number | null
          paid_at?: string | null
          payer_cpf_cnpj?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          pix_attempt_state?: string
          pix_attempts?: number
          pix_claim_expires_at?: string | null
          pix_claim_token?: string | null
          pix_post_started_at?: string | null
          platform_commission_cents?: number | null
          platform_commission_flat_cents?: number | null
          platform_commission_percent_snapshot?: number | null
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
      ledger_entries: {
        Row: {
          amount_cents: number
          business_id: string
          created_at: string
          description: string | null
          id: string
          idempotency_key: string
          metadata: Json
          payment_id: string | null
          status: string
          type: string
          withdrawal_id: string | null
        }
        Insert: {
          amount_cents: number
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          payment_id?: string | null
          status?: string
          type: string
          withdrawal_id?: string | null
        }
        Update: {
          amount_cents?: number
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          payment_id?: string | null
          status?: string
          type?: string
          withdrawal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "deposit_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "withdrawals"
            referencedColumns: ["id"]
          },
        ]
      }
      master_business_events: {
        Row: {
          actor_id: string | null
          business_id: string
          created_at: string
          description: string | null
          id: string
          title: string
          type: string
        }
        Insert: {
          actor_id?: string | null
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          title: string
          type: string
        }
        Update: {
          actor_id?: string | null
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_business_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      master_business_notes: {
        Row: {
          author_id: string | null
          body: string
          business_id: string
          created_at: string
          id: string
          next_step: string | null
        }
        Insert: {
          author_id?: string | null
          body: string
          business_id: string
          created_at?: string
          id?: string
          next_step?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string
          business_id?: string
          created_at?: string
          id?: string
          next_step?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_business_notes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      master_impersonation_sessions: {
        Row: {
          attempts: number
          business_id: string
          created_at: string
          expires_at: string
          id: string
          master_user_id: string
          token: string
        }
        Insert: {
          attempts?: number
          business_id: string
          created_at?: string
          expires_at: string
          id?: string
          master_user_id: string
          token: string
        }
        Update: {
          attempts?: number
          business_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          master_user_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_impersonation_sessions_business_id_fkey"
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
          design: Json
          id: string
          is_default: boolean
          title: string
          updated_at: string
          usage_type: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          created_by?: string | null
          design?: Json
          id?: string
          is_default?: boolean
          title: string
          updated_at?: string
          usage_type: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          design?: Json
          id?: string
          is_default?: boolean
          title?: string
          updated_at?: string
          usage_type?: string
        }
        Relationships: []
      }
      pix_key_approvals: {
        Row: {
          approved_by: string | null
          business_id: string
          created_at: string
          decided_at: string | null
          id: string
          key: string
          key_type: string
          status: string
        }
        Insert: {
          approved_by?: string | null
          business_id: string
          created_at?: string
          decided_at?: string | null
          id?: string
          key: string
          key_type: string
          status?: string
        }
        Update: {
          approved_by?: string | null
          business_id?: string
          created_at?: string
          decided_at?: string | null
          id?: string
          key?: string
          key_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pix_key_approvals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      post_service_message_queue: {
        Row: {
          appointment_id: string
          created_at: string
          id: string
          last_error: string | null
          locked_at: string | null
          processed_at: string | null
          scheduled_at: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          processed_at?: string | null
          scheduled_at: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          processed_at?: string | null
          scheduled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_service_message_queue_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          active: boolean
          agenda_name: string | null
          avatar_path: string | null
          business_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          permissions: Json
          phone: string | null
          public_name: string | null
          role: string | null
          updated_at: string
          user_id: string | null
          working_days: number[]
        }
        Insert: {
          active?: boolean
          agenda_name?: string | null
          avatar_path?: string | null
          business_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          permissions?: Json
          phone?: string | null
          public_name?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string | null
          working_days?: number[]
        }
        Update: {
          active?: boolean
          agenda_name?: string | null
          avatar_path?: string | null
          business_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          permissions?: Json
          phone?: string | null
          public_name?: string | null
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
      sdr_config: {
        Row: {
          id: boolean
          secret: string
        }
        Insert: {
          id?: boolean
          secret?: string
        }
        Update: {
          id?: boolean
          secret?: string
        }
        Relationships: []
      }
      sdr_ideas: {
        Row: {
          created_at: string
          created_by: string
          details: string
          id: string
          sdr_id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          details?: string
          id?: string
          sdr_id: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          details?: string
          id?: string
          sdr_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_ideas_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "sdrs"
            referencedColumns: ["id"]
          },
        ]
      }
      sdrs: {
        Row: {
          active: boolean
          commission_cents: number
          created_at: string
          email: string
          id: string
          name: string
          pin: string
          preset_scripts: string
          sales_goal: number
          script_notes: string
          signup_goal: number
        }
        Insert: {
          active?: boolean
          commission_cents?: number
          created_at?: string
          email: string
          id?: string
          name: string
          pin: string
          preset_scripts?: string
          sales_goal?: number
          script_notes?: string
          signup_goal?: number
        }
        Update: {
          active?: boolean
          commission_cents?: number
          created_at?: string
          email?: string
          id?: string
          name?: string
          pin?: string
          preset_scripts?: string
          sales_goal?: number
          script_notes?: string
          signup_goal?: number
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_business_id_fkey"
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
          available_days: number[]
          business_id: string
          category_id: string | null
          created_at: string
          deposit_cents: number
          deposit_mode: string
          deposit_percent_bps: number
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
          available_days?: number[]
          business_id: string
          category_id?: string | null
          created_at?: string
          deposit_cents?: number
          deposit_mode?: string
          deposit_percent_bps?: number
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
          available_days?: number[]
          business_id?: string
          category_id?: string | null
          created_at?: string
          deposit_cents?: number
          deposit_mode?: string
          deposit_percent_bps?: number
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
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_lifecycle_runs: {
        Row: {
          auth_attempts_cleaned: number
          businesses_scanned: number
          cancellations_created: number
          completed_at: string
          elapsed_ms: number
          id: string
          notices_created: number
          started_at: string
        }
        Insert: {
          auth_attempts_cleaned?: number
          businesses_scanned?: number
          cancellations_created?: number
          completed_at: string
          elapsed_ms: number
          id?: string
          notices_created?: number
          started_at: string
        }
        Update: {
          auth_attempts_cleaned?: number
          businesses_scanned?: number
          cancellations_created?: number
          completed_at?: string
          elapsed_ms?: number
          id?: string
          notices_created?: number
          started_at?: string
        }
        Relationships: []
      }
      subscription_charges: {
        Row: {
          amount_cents: number
          business_id: string
          created_at: string
          id: string
          method: string
          paid_at: string | null
          payer_cpf: string | null
          payer_email: string | null
          period_end: string | null
          period_start: string | null
          provider: string
          provider_payment_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          business_id: string
          created_at?: string
          id?: string
          method?: string
          paid_at?: string | null
          payer_cpf?: string | null
          payer_email?: string | null
          period_end?: string | null
          period_start?: string | null
          provider?: string
          provider_payment_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          business_id?: string
          created_at?: string
          id?: string
          method?: string
          paid_at?: string | null
          payer_cpf?: string | null
          payer_email?: string | null
          period_end?: string | null
          period_start?: string | null
          provider?: string
          provider_payment_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_charges_business_id_fkey"
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
      support_messages: {
        Row: {
          business_id: string
          created_at: string
          id: string
          message: string
          read_by_master: boolean
          read_by_user: boolean
          sender: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          message: string
          read_by_master?: boolean
          read_by_user?: boolean
          sender: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          message?: string
          read_by_master?: boolean
          read_by_user?: boolean
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_business_id_fkey"
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
      wallets: {
        Row: {
          available_cents: number
          business_id: string
          locked_cents: number
          pending_cents: number
          updated_at: string
        }
        Insert: {
          available_cents?: number
          business_id: string
          locked_cents?: number
          pending_cents?: number
          updated_at?: string
        }
        Update: {
          available_cents?: number
          business_id?: string
          locked_cents?: number
          pending_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_greeting_replies: {
        Row: {
          business_id: string
          claim_expires_at: string | null
          claim_token: string | null
          replied_at: string
          sender_phone: string
        }
        Insert: {
          business_id: string
          claim_expires_at?: string | null
          claim_token?: string | null
          replied_at?: string
          sender_phone: string
        }
        Update: {
          business_id?: string
          claim_expires_at?: string | null
          claim_token?: string | null
          replied_at?: string
          sender_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_greeting_replies_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          amount_cents: number
          business_id: string
          created_at: string
          id: string
          idempotency_key: string
          pix_key_snapshot: string
          platform_fee_cents: number
          provider_fee_cents: number | null
          provider_ref: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          business_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          pix_key_snapshot: string
          platform_fee_cents?: number
          provider_fee_cents?: number | null
          provider_ref?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          business_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          pix_key_snapshot?: string
          platform_fee_cents?: number
          provider_fee_cents?: number | null
          provider_ref?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      business_logos_image_business_id: {
        Args: { _name: string }
        Returns: string
      }
      business_professional_photo_business_id: {
        Args: { _name: string }
        Returns: string
      }
      business_visual_asset_business_id: {
        Args: { _name: string }
        Returns: string
      }
      cancel_overdue_business: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      claim_deposit_pix: {
        Args: { _charge_id: string; _lease_seconds?: number }
        Returns: {
          acquired: boolean
          attempt_state: string
          claim_token: string
          lease_expires_at: string
          reason: string
        }[]
      }
      claim_post_service_messages: {
        Args: { p_limit?: number }
        Returns: {
          appointment_id: string
          id: string
        }[]
      }
      claim_whatsapp_greeting: {
        Args: { p_business_id: string; p_sender_phone: string }
        Returns: string
      }
      finish_whatsapp_greeting: {
        Args: {
          p_business_id: string
          p_claim_token: string
          p_sender_phone: string
          p_sent: boolean
        }
        Returns: boolean
      }
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
      ledger_adjustment: {
        Args: {
          _amount_cents: number
          _business_id: string
          _description: string
          _idempotency_key: string
        }
        Returns: {
          created: boolean
          entry_id: string
        }[]
      }
      ledger_credit_payment: {
        Args: {
          _amount_cents: number
          _business_id: string
          _description: string
          _idempotency_key: string
          _metadata?: Json
          _payment_id: string
        }
        Returns: {
          created: boolean
          entry_id: string
        }[]
      }
      ledger_debit_refund: {
        Args: {
          _amount_cents: number
          _business_id: string
          _description: string
          _idempotency_key: string
          _payment_id: string
        }
        Returns: {
          created: boolean
          entry_id: string
        }[]
      }
      ledger_request_withdrawal: {
        Args: {
          _amount_cents: number
          _business_id: string
          _idempotency_key: string
          _withdrawal_id: string
        }
        Returns: {
          accepted: boolean
          available_cents: number
          entry_id: string
        }[]
      }
      ledger_reverse_withdrawal: {
        Args: {
          _amount_cents: number
          _business_id: string
          _idempotency_key: string
          _withdrawal_id: string
        }
        Returns: {
          created: boolean
          entry_id: string
        }[]
      }
      ledger_settle_withdrawal: {
        Args: {
          _outcome: string
          _provider_ref?: string
          _withdrawal_id: string
        }
        Returns: {
          changed: boolean
          final_status: string
        }[]
      }
      mark_deposit_pix_post_started: {
        Args: {
          _charge_id: string
          _claim_token: string
          _lease_seconds?: number
        }
        Returns: boolean
      }
      owns_business: { Args: { _business_id: string }; Returns: boolean }
      register_auth_failure: {
        Args: {
          p_key: string
          p_limit: number
          p_lock_ms: number
          p_window_ms: number
        }
        Returns: number
      }
      release_deposit_pix: {
        Args: { _charge_id: string; _claim_token: string; _outcome: string }
        Returns: boolean
      }
      replace_professional_services: {
        Args: {
          _business_id: string
          _professional_id: string
          _service_ids: string[]
        }
        Returns: undefined
      }
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
  public: {
    Enums: {
      app_role: ["super_admin", "owner", "professional"],
    },
  },
} as const
