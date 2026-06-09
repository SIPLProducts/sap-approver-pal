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
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          payload: Json | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      approval_attachments: {
        Row: {
          created_at: string
          document_id: string
          file_name: string
          file_url: string
          id: string
          mime_type: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_id: string
          file_name: string
          file_url: string
          id?: string
          mime_type?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string
          file_name?: string
          file_url?: string
          id?: string
          mime_type?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_attachments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "approval_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_documents: {
        Row: {
          business_unit: string | null
          company_code: string | null
          created_at: string
          currency: string
          current_step_seq: number
          customer_name: string | null
          description: string | null
          doc_type: Database["public"]["Enums"]["document_type"]
          document_date: string
          id: string
          module: Database["public"]["Enums"]["sap_module"]
          plant: string | null
          raised_by_user: string | null
          requester_name: string
          requester_sap_id: string | null
          sap_doc_no: string
          sap_payload: Json | null
          sap_t_code: string
          status: Database["public"]["Enums"]["doc_status"]
          title: string
          total_value: number
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          business_unit?: string | null
          company_code?: string | null
          created_at?: string
          currency?: string
          current_step_seq?: number
          customer_name?: string | null
          description?: string | null
          doc_type: Database["public"]["Enums"]["document_type"]
          document_date?: string
          id?: string
          module: Database["public"]["Enums"]["sap_module"]
          plant?: string | null
          raised_by_user?: string | null
          requester_name: string
          requester_sap_id?: string | null
          sap_doc_no: string
          sap_payload?: Json | null
          sap_t_code: string
          status?: Database["public"]["Enums"]["doc_status"]
          title: string
          total_value?: number
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          business_unit?: string | null
          company_code?: string | null
          created_at?: string
          currency?: string
          current_step_seq?: number
          customer_name?: string | null
          description?: string | null
          doc_type?: Database["public"]["Enums"]["document_type"]
          document_date?: string
          id?: string
          module?: Database["public"]["Enums"]["sap_module"]
          plant?: string | null
          raised_by_user?: string | null
          requester_name?: string
          requester_sap_id?: string | null
          sap_doc_no?: string
          sap_payload?: Json | null
          sap_t_code?: string
          status?: Database["public"]["Enums"]["doc_status"]
          title?: string
          total_value?: number
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: []
      }
      approval_line_items: {
        Row: {
          amount: number | null
          created_at: string
          description: string
          document_id: string
          id: string
          line_no: number
          material_code: string | null
          quantity: number | null
          unit_price: number | null
          uom: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description: string
          document_id: string
          id?: string
          line_no: number
          material_code?: string | null
          quantity?: number | null
          unit_price?: number | null
          uom?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string
          document_id?: string
          id?: string
          line_no?: number
          material_code?: string | null
          quantity?: number | null
          unit_price?: number | null
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_line_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "approval_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_matrix: {
        Row: {
          created_at: string
          currency: string
          id: string
          is_active: boolean
          max_amount: number | null
          min_amount: number
          role_key: string
          stage_no: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number
          role_key: string
          stage_no: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number
          role_key?: string
          stage_no?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_matrix_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_steps: {
        Row: {
          assigned_user: string | null
          comments: string | null
          created_at: string
          decided_at: string | null
          document_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          seq: number
          status: Database["public"]["Enums"]["step_status"]
        }
        Insert: {
          assigned_user?: string | null
          comments?: string | null
          created_at?: string
          decided_at?: string | null
          document_id: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          seq: number
          status?: Database["public"]["Enums"]["step_status"]
        }
        Update: {
          assigned_user?: string | null
          comments?: string | null
          created_at?: string
          decided_at?: string | null
          document_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          seq?: number
          status?: Database["public"]["Enums"]["step_status"]
        }
        Relationships: [
          {
            foreignKeyName: "approval_steps_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "approval_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_strategies: {
        Row: {
          active: boolean
          business_unit: string | null
          company_code: string | null
          created_at: string
          doc_type: Database["public"]["Enums"]["document_type"]
          id: string
          max_value: number | null
          min_value: number | null
          roles_in_order: Database["public"]["Enums"]["app_role"][]
        }
        Insert: {
          active?: boolean
          business_unit?: string | null
          company_code?: string | null
          created_at?: string
          doc_type: Database["public"]["Enums"]["document_type"]
          id?: string
          max_value?: number | null
          min_value?: number | null
          roles_in_order: Database["public"]["Enums"]["app_role"][]
        }
        Update: {
          active?: boolean
          business_unit?: string | null
          company_code?: string | null
          created_at?: string
          doc_type?: Database["public"]["Enums"]["document_type"]
          id?: string
          max_value?: number | null
          min_value?: number | null
          roles_in_order?: Database["public"]["Enums"]["app_role"][]
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          actor_name: string | null
          created_at: string
          details: Json | null
          document_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          document_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          document_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "approval_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          document_id: string | null
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "approval_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_unit: string | null
          company_code: string | null
          created_at: string
          designation: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          plant: string | null
          sap_user_id: string | null
          updated_at: string
        }
        Insert: {
          business_unit?: string | null
          company_code?: string | null
          created_at?: string
          designation?: string | null
          email?: string
          full_name?: string
          id: string
          phone?: string | null
          plant?: string | null
          sap_user_id?: string | null
          updated_at?: string
        }
        Update: {
          business_unit?: string | null
          company_code?: string | null
          created_at?: string
          designation?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          plant?: string | null
          sap_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_label: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_label?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_label?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          action: string
          allowed: boolean
          built_in_role: Database["public"]["Enums"]["app_role"] | null
          created_at: string
          custom_role_id: string | null
          id: string
          screen_key: string
        }
        Insert: {
          action: string
          allowed?: boolean
          built_in_role?: Database["public"]["Enums"]["app_role"] | null
          created_at?: string
          custom_role_id?: string | null
          id?: string
          screen_key: string
        }
        Update: {
          action?: string
          allowed?: boolean
          built_in_role?: Database["public"]["Enums"]["app_role"] | null
          created_at?: string
          custom_role_id?: string | null
          id?: string
          screen_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      sap_api_configs: {
        Row: {
          api_type: string
          auth_type: string
          auto_sync_enabled: boolean
          created_at: string
          created_by: string | null
          description: string | null
          endpoint_url: string
          http_method: string
          id: string
          is_active: boolean
          last_synced_at: string | null
          middleware_url: string | null
          module: string
          name: string
          next_sync_at: string | null
          proxy_secret_ref: string | null
          schedule_cron: string | null
          updated_at: string
        }
        Insert: {
          api_type?: string
          auth_type?: string
          auto_sync_enabled?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          endpoint_url: string
          http_method?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          middleware_url?: string | null
          module?: string
          name: string
          next_sync_at?: string | null
          proxy_secret_ref?: string | null
          schedule_cron?: string | null
          updated_at?: string
        }
        Update: {
          api_type?: string
          auth_type?: string
          auto_sync_enabled?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          endpoint_url?: string
          http_method?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          middleware_url?: string | null
          module?: string
          name?: string
          next_sync_at?: string | null
          proxy_secret_ref?: string | null
          schedule_cron?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sap_api_credentials: {
        Row: {
          config_id: string
          extra_headers: Json
          password_encrypted: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          config_id: string
          extra_headers?: Json
          password_encrypted?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          config_id?: string
          extra_headers?: Json
          password_encrypted?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sap_api_credentials_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: true
            referencedRelation: "sap_api_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      sap_api_request_fields: {
        Row: {
          config_id: string
          default_value: string | null
          field_name: string
          id: string
          required: boolean
          sort_order: number
          source: string
        }
        Insert: {
          config_id: string
          default_value?: string | null
          field_name: string
          id?: string
          required?: boolean
          sort_order?: number
          source?: string
        }
        Update: {
          config_id?: string
          default_value?: string | null
          field_name?: string
          id?: string
          required?: boolean
          sort_order?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "sap_api_request_fields_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "sap_api_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      sap_api_response_fields: {
        Row: {
          config_id: string
          field_name: string
          id: string
          sort_order: number
          target_column: string | null
          target_table: string | null
          transform_expr: string | null
        }
        Insert: {
          config_id: string
          field_name: string
          id?: string
          sort_order?: number
          target_column?: string | null
          target_table?: string | null
          transform_expr?: string | null
        }
        Update: {
          config_id?: string
          field_name?: string
          id?: string
          sort_order?: number
          target_column?: string | null
          target_table?: string | null
          transform_expr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sap_api_response_fields_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "sap_api_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      sap_api_sync_log: {
        Row: {
          config_id: string
          id: string
          latency_ms: number | null
          message: string | null
          rows_processed: number | null
          run_at: string
          status: string
        }
        Insert: {
          config_id: string
          id?: string
          latency_ms?: number | null
          message?: string | null
          rows_processed?: number | null
          run_at?: string
          status: string
        }
        Update: {
          config_id?: string
          id?: string
          latency_ms?: number | null
          message?: string | null
          rows_processed?: number | null
          run_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sap_api_sync_log_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "sap_api_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_custom_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          custom_role_id: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          custom_role_id: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          custom_role_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_roles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
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
      user_tenants: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_doc_raiser: {
        Args: { _doc_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_step_on_doc: {
        Args: { _doc_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "F1"
        | "F2"
        | "F3"
        | "F4"
        | "F5"
        | "F6"
        | "M1"
        | "M2"
        | "M3"
        | "M4"
        | "M5"
        | "MD"
        | "S2"
        | "S3"
        | "S4"
        | "T1"
        | "T4"
        | "T5"
        | "T6"
        | "IC"
        | "ZZ"
        | "SR"
        | "C1"
        | "HOD"
        | "PlantHead"
        | "SCMHead"
        | "StoreHOD"
        | "ProjectHead"
        | "FinanceHead"
        | "MBD"
        | "FA"
        | "Admin"
      doc_status:
        | "pending"
        | "approved"
        | "rejected"
        | "sent_back"
        | "cancelled"
      document_type:
        | "ZNFA"
        | "ZNFA_TER"
        | "PR"
        | "PO"
        | "SR"
        | "MIGO"
        | "ZGP"
        | "ZMM_REV"
        | "ZMM_GATE"
        | "BMW_PRICE"
        | "BMW_CONTRACT"
        | "BMW_SO"
        | "BMW_ZERO_WASTE"
        | "BMW_SC_ISSUE"
        | "IWM_PRICE"
        | "IWM_GATE"
        | "SD_VK11"
        | "SD_ZV13"
        | "SD_ZREP_SCR"
      sap_module: "MM" | "SD"
      step_status:
        | "pending"
        | "approved"
        | "rejected"
        | "sent_back"
        | "skipped"
        | "waiting"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: [
        "F1",
        "F2",
        "F3",
        "F4",
        "F5",
        "F6",
        "M1",
        "M2",
        "M3",
        "M4",
        "M5",
        "MD",
        "S2",
        "S3",
        "S4",
        "T1",
        "T4",
        "T5",
        "T6",
        "IC",
        "ZZ",
        "SR",
        "C1",
        "HOD",
        "PlantHead",
        "SCMHead",
        "StoreHOD",
        "ProjectHead",
        "FinanceHead",
        "MBD",
        "FA",
        "Admin",
      ],
      doc_status: ["pending", "approved", "rejected", "sent_back", "cancelled"],
      document_type: [
        "ZNFA",
        "ZNFA_TER",
        "PR",
        "PO",
        "SR",
        "MIGO",
        "ZGP",
        "ZMM_REV",
        "ZMM_GATE",
        "BMW_PRICE",
        "BMW_CONTRACT",
        "BMW_SO",
        "BMW_ZERO_WASTE",
        "BMW_SC_ISSUE",
        "IWM_PRICE",
        "IWM_GATE",
        "SD_VK11",
        "SD_ZV13",
        "SD_ZREP_SCR",
      ],
      sap_module: ["MM", "SD"],
      step_status: [
        "pending",
        "approved",
        "rejected",
        "sent_back",
        "skipped",
        "waiting",
      ],
    },
  },
} as const
