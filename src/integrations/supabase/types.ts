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
      ai_image_usage: {
        Row: {
          count: number
          updated_at: string
          used_on: string
          user_id: string
        }
        Insert: {
          count?: number
          updated_at?: string
          used_on?: string
          user_id: string
        }
        Update: {
          count?: number
          updated_at?: string
          used_on?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          prompt: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          prompt: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          prompt?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      app_versions: {
        Row: {
          apk_size: number | null
          app_id: string
          created_at: string
          file_path: string | null
          id: string
          package_name: string | null
          permissions: string[] | null
          permissions_added: string[] | null
          permissions_removed: string[] | null
          release_notes: string | null
          version: string
          version_code: number | null
        }
        Insert: {
          apk_size?: number | null
          app_id: string
          created_at?: string
          file_path?: string | null
          id?: string
          package_name?: string | null
          permissions?: string[] | null
          permissions_added?: string[] | null
          permissions_removed?: string[] | null
          release_notes?: string | null
          version: string
          version_code?: number | null
        }
        Update: {
          apk_size?: number | null
          app_id?: string
          created_at?: string
          file_path?: string | null
          id?: string
          package_name?: string | null
          permissions?: string[] | null
          permissions_added?: string[] | null
          permissions_removed?: string[] | null
          release_notes?: string | null
          version?: string
          version_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "app_versions_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      apps: {
        Row: {
          apk_size: number | null
          app_url: string | null
          category: Database["public"]["Enums"]["app_category"]
          created_at: string
          description: string | null
          developer_id: string | null
          file_path: string | null
          icon_url: string | null
          id: string
          install_count: number
          is_published: boolean
          last_updated_at: string
          latest_release_notes: string | null
          name: string
          package_name: string | null
          permissions: string[] | null
          platform: string | null
          rating_avg: number
          rating_count: number
          screenshots: string[]
          slug: string
          status: string
          tagline: string | null
          updated_at: string
          version: string
          version_code: number | null
        }
        Insert: {
          apk_size?: number | null
          app_url?: string | null
          category?: Database["public"]["Enums"]["app_category"]
          created_at?: string
          description?: string | null
          developer_id?: string | null
          file_path?: string | null
          icon_url?: string | null
          id?: string
          install_count?: number
          is_published?: boolean
          last_updated_at?: string
          latest_release_notes?: string | null
          name: string
          package_name?: string | null
          permissions?: string[] | null
          platform?: string | null
          rating_avg?: number
          rating_count?: number
          screenshots?: string[]
          slug: string
          status?: string
          tagline?: string | null
          updated_at?: string
          version?: string
          version_code?: number | null
        }
        Update: {
          apk_size?: number | null
          app_url?: string | null
          category?: Database["public"]["Enums"]["app_category"]
          created_at?: string
          description?: string | null
          developer_id?: string | null
          file_path?: string | null
          icon_url?: string | null
          id?: string
          install_count?: number
          is_published?: boolean
          last_updated_at?: string
          latest_release_notes?: string | null
          name?: string
          package_name?: string | null
          permissions?: string[] | null
          platform?: string | null
          rating_avg?: number
          rating_count?: number
          screenshots?: string[]
          slug?: string
          status?: string
          tagline?: string | null
          updated_at?: string
          version?: string
          version_code?: number | null
        }
        Relationships: []
      }
      installs: {
        Row: {
          app_id: string
          id: string
          installed_at: string
          installed_version: string | null
          user_id: string
        }
        Insert: {
          app_id: string
          id?: string
          installed_at?: string
          installed_version?: string | null
          user_id: string
        }
        Update: {
          app_id?: string
          id?: string
          installed_at?: string
          installed_version?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installs_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_kobo: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          provider: string
          raw: Json | null
          reference: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          provider?: string
          raw?: Json | null
          reference: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          provider?: string
          raw?: Json | null
          reference?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_premium: boolean
          premium_expires_at: string | null
          premium_since: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_premium?: boolean
          premium_expires_at?: string | null
          premium_since?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_premium?: boolean
          premium_expires_at?: string | null
          premium_since?: string | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          grant_type: string
          max_uses: number | null
          trial_days: number | null
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          grant_type: string
          max_uses?: number | null
          trial_days?: number | null
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          grant_type?: string
          max_uses?: number | null
          trial_days?: number | null
          uses?: number
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          code: string
          id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          code: string
          id?: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          code?: string
          id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      reviews: {
        Row: {
          app_id: string
          body: string | null
          created_at: string
          dev_replied_at: string | null
          dev_reply: string | null
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          app_id: string
          body?: string | null
          created_at?: string
          dev_replied_at?: string | null
          dev_reply?: string | null
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          app_id?: string
          body?: string | null
          created_at?: string
          dev_replied_at?: string | null
          dev_reply?: string | null
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
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
      public_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      semver_to_int_array: { Args: { v: string }; Returns: number[] }
    }
    Enums: {
      app_category: "app" | "game" | "ai_video"
      app_role: "admin" | "developer" | "user" | "jasper_ai"
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
      app_category: ["app", "game", "ai_video"],
      app_role: ["admin", "developer", "user", "jasper_ai"],
    },
  },
} as const
