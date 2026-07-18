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
      ad_campaigns: {
        Row: {
          advertiser_id: string
          app_id: string
          clicks_count: number
          cost_per_view_kobo: number
          created_at: string
          daily_budget_kobo: number
          downloads_count: number
          duration_days: number
          ends_at: string | null
          format: string
          id: string
          impressions_count: number
          moderator_note: string | null
          name: string
          paid_at: string | null
          payment_reference: string | null
          spent_kobo: number
          starts_at: string | null
          status: string
          target_categories: string[]
          target_countries: string[]
          total_budget_kobo: number
          updated_at: string
          views_count: number
        }
        Insert: {
          advertiser_id: string
          app_id: string
          clicks_count?: number
          cost_per_view_kobo?: number
          created_at?: string
          daily_budget_kobo: number
          downloads_count?: number
          duration_days: number
          ends_at?: string | null
          format: string
          id?: string
          impressions_count?: number
          moderator_note?: string | null
          name: string
          paid_at?: string | null
          payment_reference?: string | null
          spent_kobo?: number
          starts_at?: string | null
          status?: string
          target_categories?: string[]
          target_countries?: string[]
          total_budget_kobo: number
          updated_at?: string
          views_count?: number
        }
        Update: {
          advertiser_id?: string
          app_id?: string
          clicks_count?: number
          cost_per_view_kobo?: number
          created_at?: string
          daily_budget_kobo?: number
          downloads_count?: number
          duration_days?: number
          ends_at?: string | null
          format?: string
          id?: string
          impressions_count?: number
          moderator_note?: string | null
          name?: string
          paid_at?: string | null
          payment_reference?: string | null
          spent_kobo?: number
          starts_at?: string | null
          status?: string
          target_categories?: string[]
          target_countries?: string[]
          total_budget_kobo?: number
          updated_at?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_clicks: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_clicks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_impressions: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          placement: string
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          placement: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          placement?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_impressions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_view_sessions: {
        Row: {
          campaign_id: string
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          required_seconds: number
          started_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          required_seconds?: number
          started_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          required_seconds?: number
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_view_sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
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
          content_rating: string | null
          created_at: string
          description: string | null
          developer_email: string | null
          developer_id: string | null
          developer_name: string | null
          download_count: number
          feature_banner_url: string | null
          featured_at: string | null
          file_path: string | null
          icon_url: string | null
          id: string
          install_count: number
          is_draft: boolean
          is_featured: boolean
          is_published: boolean
          languages: string[]
          last_updated_at: string
          latest_release_notes: string | null
          license: string
          min_android_version: string | null
          name: string
          package_name: string | null
          permissions: string[] | null
          platform: string | null
          price_kobo: number
          privacy_policy_url: string | null
          promo_video_path: string | null
          rating_avg: number
          rating_count: number
          screenshots: string[]
          short_description: string | null
          slug: string
          status: string
          subcategory: string | null
          tagline: string | null
          tags: string[]
          target_android_version: string | null
          updated_at: string
          version: string
          version_code: number | null
          website_url: string | null
        }
        Insert: {
          apk_size?: number | null
          app_url?: string | null
          category?: Database["public"]["Enums"]["app_category"]
          content_rating?: string | null
          created_at?: string
          description?: string | null
          developer_email?: string | null
          developer_id?: string | null
          developer_name?: string | null
          download_count?: number
          feature_banner_url?: string | null
          featured_at?: string | null
          file_path?: string | null
          icon_url?: string | null
          id?: string
          install_count?: number
          is_draft?: boolean
          is_featured?: boolean
          is_published?: boolean
          languages?: string[]
          last_updated_at?: string
          latest_release_notes?: string | null
          license?: string
          min_android_version?: string | null
          name: string
          package_name?: string | null
          permissions?: string[] | null
          platform?: string | null
          price_kobo?: number
          privacy_policy_url?: string | null
          promo_video_path?: string | null
          rating_avg?: number
          rating_count?: number
          screenshots?: string[]
          short_description?: string | null
          slug: string
          status?: string
          subcategory?: string | null
          tagline?: string | null
          tags?: string[]
          target_android_version?: string | null
          updated_at?: string
          version?: string
          version_code?: number | null
          website_url?: string | null
        }
        Update: {
          apk_size?: number | null
          app_url?: string | null
          category?: Database["public"]["Enums"]["app_category"]
          content_rating?: string | null
          created_at?: string
          description?: string | null
          developer_email?: string | null
          developer_id?: string | null
          developer_name?: string | null
          download_count?: number
          feature_banner_url?: string | null
          featured_at?: string | null
          file_path?: string | null
          icon_url?: string | null
          id?: string
          install_count?: number
          is_draft?: boolean
          is_featured?: boolean
          is_published?: boolean
          languages?: string[]
          last_updated_at?: string
          latest_release_notes?: string | null
          license?: string
          min_android_version?: string | null
          name?: string
          package_name?: string | null
          permissions?: string[] | null
          platform?: string | null
          price_kobo?: number
          privacy_policy_url?: string | null
          promo_video_path?: string | null
          rating_avg?: number
          rating_count?: number
          screenshots?: string[]
          short_description?: string | null
          slug?: string
          status?: string
          subcategory?: string | null
          tagline?: string | null
          tags?: string[]
          target_android_version?: string | null
          updated_at?: string
          version?: string
          version_code?: number | null
          website_url?: string | null
        }
        Relationships: []
      }
      collection_apps: {
        Row: {
          app_id: string
          collection_id: string
          created_at: string
          sort_order: number
        }
        Insert: {
          app_id: string
          collection_id: string
          created_at?: string
          sort_order?: number
        }
        Update: {
          app_id?: string
          collection_id?: string
          created_at?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_apps_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_apps_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_published: boolean
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          app_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          app_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          app_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
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
      notifications: {
        Row: {
          app_id: string | null
          body: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          app_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          app_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_app_id_fkey"
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
          bio: string | null
          bonus_ai_credits: number
          created_at: string
          display_name: string | null
          id: string
          is_premium: boolean
          premium_expires_at: string | null
          premium_since: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          bonus_ai_credits?: number
          created_at?: string
          display_name?: string | null
          id: string
          is_premium?: boolean
          premium_expires_at?: string | null
          premium_since?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          bonus_ai_credits?: number
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
      recently_viewed: {
        Row: {
          app_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          app_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          app_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recently_viewed_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          app_id: string
          created_at: string
          details: string | null
          id: string
          reason: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_id: string
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_id?: string
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
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
