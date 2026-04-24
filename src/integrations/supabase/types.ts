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
      client_accounts: {
        Row: {
          admin_notes: string | null
          alert_70_sent: boolean
          alert_90_sent: boolean
          assigned_pm_id: string | null
          assigned_specialist_id: string | null
          client_since: string | null
          created_at: string
          current_rate: number
          health_status: string | null
          hours_purchased: number
          hours_used: number
          id: string
          monthly_allocation: number | null
          onboarding_date: string | null
          rollover_hours: number | null
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          alert_70_sent?: boolean
          alert_90_sent?: boolean
          assigned_pm_id?: string | null
          assigned_specialist_id?: string | null
          client_since?: string | null
          created_at?: string
          current_rate?: number
          health_status?: string | null
          hours_purchased?: number
          hours_used?: number
          id?: string
          monthly_allocation?: number | null
          onboarding_date?: string | null
          rollover_hours?: number | null
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          alert_70_sent?: boolean
          alert_90_sent?: boolean
          assigned_pm_id?: string | null
          assigned_specialist_id?: string | null
          client_since?: string | null
          created_at?: string
          current_rate?: number
          health_status?: string | null
          hours_purchased?: number
          hours_used?: number
          id?: string
          monthly_allocation?: number | null
          onboarding_date?: string | null
          rollover_hours?: number | null
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      client_onboarding: {
        Row: {
          acquisition_channels: string[] | null
          business_name: string | null
          client_account_id: string
          completed_at: string | null
          created_at: string | null
          crm_platform: string | null
          goals: string | null
          has_existing_crm: boolean | null
          id: string
          industry: string | null
          landing_pages: string[] | null
          pain_points: string | null
          primary_homepage: string | null
        }
        Insert: {
          acquisition_channels?: string[] | null
          business_name?: string | null
          client_account_id: string
          completed_at?: string | null
          created_at?: string | null
          crm_platform?: string | null
          goals?: string | null
          has_existing_crm?: boolean | null
          id?: string
          industry?: string | null
          landing_pages?: string[] | null
          pain_points?: string | null
          primary_homepage?: string | null
        }
        Update: {
          acquisition_channels?: string[] | null
          business_name?: string | null
          client_account_id?: string
          completed_at?: string | null
          created_at?: string | null
          crm_platform?: string | null
          goals?: string | null
          has_existing_crm?: boolean | null
          id?: string
          industry?: string | null
          landing_pages?: string[] | null
          pain_points?: string | null
          primary_homepage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: true
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_specialists: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          client_account_id: string
          id: string
          specialist_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          client_account_id: string
          id?: string
          specialist_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          client_account_id?: string
          id?: string
          specialist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_specialists_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      hour_blocks: {
        Row: {
          client_account_id: string
          created_at: string
          hours: number
          id: string
          rate: number
          stripe_payment_id: string | null
          total_amount: number
        }
        Insert: {
          client_account_id: string
          created_at?: string
          hours: number
          id?: string
          rate: number
          stripe_payment_id?: string | null
          total_amount: number
        }
        Update: {
          client_account_id?: string
          created_at?: string
          hours?: number
          id?: string
          rate?: number
          stripe_payment_id?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "hour_blocks_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      hour_credits: {
        Row: {
          client_account_id: string
          created_at: string | null
          credited_by: string
          hours: number
          id: string
          reason: string
        }
        Insert: {
          client_account_id: string
          created_at?: string | null
          credited_by: string
          hours: number
          id?: string
          reason: string
        }
        Update: {
          client_account_id?: string
          created_at?: string | null
          credited_by?: string
          hours?: number
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "hour_credits_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_account_id: string
          created_at: string
          hour_block_id: string | null
          id: string
          status: string
          stripe_invoice_id: string | null
          total_amount: number
        }
        Insert: {
          client_account_id: string
          created_at?: string
          hour_block_id?: string | null
          id?: string
          status?: string
          stripe_invoice_id?: string | null
          total_amount: number
        }
        Update: {
          client_account_id?: string
          created_at?: string
          hour_block_id?: string | null
          id?: string
          status?: string
          stripe_invoice_id?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_hour_block_id_fkey"
            columns: ["hour_block_id"]
            isOneToOne: false
            referencedRelation: "hour_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_id: string
          task_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_id: string
          task_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          task_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          task_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          task_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          email: string | null
          full_name: string | null
          health_score: number | null
          id: string
          salary: number | null
          specialist_bio: string | null
          specialist_certification: string | null
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          health_score?: number | null
          id?: string
          salary?: number | null
          specialist_bio?: string | null
          specialist_certification?: string | null
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          health_score?: number | null
          id?: string
          salary?: number | null
          specialist_bio?: string | null
          specialist_certification?: string | null
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      specialist_milestones: {
        Row: {
          achieved_at: string | null
          created_at: string | null
          id: string
          specialist_id: string
          title: string
        }
        Insert: {
          achieved_at?: string | null
          created_at?: string | null
          id?: string
          specialist_id: string
          title: string
        }
        Update: {
          achieved_at?: string | null
          created_at?: string | null
          id?: string
          specialist_id?: string
          title?: string
        }
        Relationships: []
      }
      task_activity_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string | null
          details: Json | null
          id: string
          task_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          task_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_approvals: {
        Row: {
          acted_by: string
          action: Database["public"]["Enums"]["approval_action"]
          comment: string | null
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          acted_by: string
          action: Database["public"]["Enums"]["approval_action"]
          comment?: string | null
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          acted_by?: string
          action?: Database["public"]["Enums"]["approval_action"]
          comment?: string | null
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_approvals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_credentials: {
        Row: {
          client_id: string
          created_at: string
          credential_value: string
          id: string
          label: string
          task_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          credential_value: string
          id?: string
          label: string
          task_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          credential_value?: string
          id?: string
          label?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_credentials_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_deliverables: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          task_id: string
          type: Database["public"]["Enums"]["deliverable_type"]
          uploaded_by: string
          url: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          task_id: string
          type: Database["public"]["Enums"]["deliverable_type"]
          uploaded_by: string
          url: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          task_id?: string
          type?: Database["public"]["Enums"]["deliverable_type"]
          uploaded_by?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_deliverables_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_specialists: {
        Row: {
          assigned_at: string | null
          id: string
          role: string | null
          specialist_id: string
          task_id: string
        }
        Insert: {
          assigned_at?: string | null
          id?: string
          role?: string | null
          specialist_id: string
          task_id: string
        }
        Update: {
          assigned_at?: string | null
          id?: string
          role?: string | null
          specialist_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_specialists_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_hours: number | null
          assigned_specialist_id: string | null
          at_risk: boolean | null
          category: string | null
          client_account_id: string
          created_at: string
          created_by: string | null
          description: string | null
          estimated_hours: number | null
          id: string
          is_urgent: boolean
          name: string
          priority: string
          requested_by: string | null
          status: Database["public"]["Enums"]["task_status"]
          subtasks: Json | null
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          assigned_specialist_id?: string | null
          at_risk?: boolean | null
          category?: string | null
          client_account_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_urgent?: boolean
          name: string
          priority?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          subtasks?: Json | null
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          assigned_specialist_id?: string | null
          at_risk?: boolean | null
          category?: string | null
          client_account_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_urgent?: boolean
          name?: string
          priority?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          subtasks?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      time_logs: {
        Row: {
          activity_label: string | null
          activity_type: string | null
          billable: boolean
          created_at: string
          description: string | null
          hours: number
          id: string
          logged_at: string
          specialist_id: string
          task_id: string | null
        }
        Insert: {
          activity_label?: string | null
          activity_type?: string | null
          billable?: boolean
          created_at?: string
          description?: string | null
          hours: number
          id?: string
          logged_at?: string
          specialist_id: string
          task_id?: string | null
        }
        Update: {
          activity_label?: string | null
          activity_type?: string | null
          billable?: boolean
          created_at?: string
          description?: string | null
          hours?: number
          id?: string
          logged_at?: string
          specialist_id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
    }
    Enums: {
      app_role: "client" | "specialist" | "admin" | "tech_lead" | "super_admin"
      approval_action: "approved" | "declined" | "changes_requested"
      deliverable_type: "file" | "link" | "loom"
      task_category:
        | "automation"
        | "funnel"
        | "pipeline"
        | "website"
        | "integration"
        | "reporting"
        | "other"
      task_status:
        | "submitted"
        | "in_review"
        | "in_progress"
        | "awaiting_input"
        | "ready_for_review"
        | "completed"
        | "declined"
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
      app_role: ["client", "specialist", "admin", "tech_lead", "super_admin"],
      approval_action: ["approved", "declined", "changes_requested"],
      deliverable_type: ["file", "link", "loom"],
      task_category: [
        "automation",
        "funnel",
        "pipeline",
        "website",
        "integration",
        "reporting",
        "other",
      ],
      task_status: [
        "submitted",
        "in_review",
        "in_progress",
        "awaiting_input",
        "ready_for_review",
        "completed",
        "declined",
      ],
    },
  },
} as const
