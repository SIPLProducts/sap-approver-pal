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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
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
