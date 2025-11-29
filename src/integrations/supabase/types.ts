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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      affiliate_clicks: {
        Row: {
          clicked_at: string
          game_id: string
          id: string
          referrer_url: string | null
          store_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          clicked_at?: string
          game_id: string
          id?: string
          referrer_url?: string | null
          store_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          clicked_at?: string
          game_id?: string
          id?: string
          referrer_url?: string | null
          store_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_claims: {
        Row: {
          dev_x_handle: string | null
          game_id: string | null
          game_title: string
          id: string
          itchio_url: string | null
          status: string
          steam_url: string | null
          submitted_at: string
          user_id: string
        }
        Insert: {
          dev_x_handle?: string | null
          game_id?: string | null
          game_title: string
          id?: string
          itchio_url?: string | null
          status?: string
          steam_url?: string | null
          submitted_at?: string
          user_id: string
        }
        Update: {
          dev_x_handle?: string | null
          game_id?: string | null
          game_title?: string
          id?: string
          itchio_url?: string | null
          status?: string
          steam_url?: string | null
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dev_claims_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_interactions: {
        Row: {
          action: string
          created_at: string
          game_id: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          game_id: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          game_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_interactions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          amazon_affiliate_url: string | null
          boost_ends_at: string | null
          boost_priority: number | null
          created_at: string
          description: string
          dev_x_handle: string | null
          featured_at: string | null
          hook_text: string
          id: string
          itchio_url: string | null
          status: string
          steam_url: string | null
          tags: string[] | null
          title: string
          trailer_url: string
          upvotes: number | null
          views: number | null
        }
        Insert: {
          amazon_affiliate_url?: string | null
          boost_ends_at?: string | null
          boost_priority?: number | null
          created_at?: string
          description: string
          dev_x_handle?: string | null
          featured_at?: string | null
          hook_text: string
          id?: string
          itchio_url?: string | null
          status?: string
          steam_url?: string | null
          tags?: string[] | null
          title: string
          trailer_url: string
          upvotes?: number | null
          views?: number | null
        }
        Update: {
          amazon_affiliate_url?: string | null
          boost_ends_at?: string | null
          boost_priority?: number | null
          created_at?: string
          description?: string
          dev_x_handle?: string | null
          featured_at?: string | null
          hook_text?: string
          id?: string
          itchio_url?: string | null
          status?: string
          steam_url?: string | null
          tags?: string[] | null
          title?: string
          trailer_url?: string
          upvotes?: number | null
          views?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_pro_dev: boolean | null
          stripe_connect_account_id: string | null
          stripe_connect_onboarded: boolean | null
          subscription_ends_at: string | null
          user_type: string
          x_handle: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          is_pro_dev?: boolean | null
          stripe_connect_account_id?: string | null
          stripe_connect_onboarded?: boolean | null
          subscription_ends_at?: string | null
          user_type?: string
          x_handle?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_pro_dev?: boolean | null
          stripe_connect_account_id?: string | null
          stripe_connect_onboarded?: boolean | null
          subscription_ends_at?: string | null
          user_type?: string
          x_handle?: string | null
        }
        Relationships: []
      }
      tips: {
        Row: {
          amount: number
          created_at: string
          currency: string
          from_user_id: string
          game_id: string
          id: string
          platform_fee: number
          stripe_payment_intent_id: string | null
          to_user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          from_user_id: string
          game_id: string
          id?: string
          platform_fee?: number
          stripe_payment_intent_id?: string | null
          to_user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          from_user_id?: string
          game_id?: string
          id?: string
          platform_fee?: number
          stripe_payment_intent_id?: string | null
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tips_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string | null
          id: string
          metadata: Json | null
          status: string
          stripe_payment_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          stripe_payment_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          stripe_payment_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_stale_games: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
