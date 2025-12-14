export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      announcement_assets: {
        Row: {
          announcement_id: string | null
          created_at: string | null
          file_name: string
          file_size: number
          file_url: string
          id: string
          mime_type: string
          upload_path: string
        }
        Insert: {
          announcement_id?: string | null
          created_at?: string | null
          file_name: string
          file_size: number
          file_url: string
          id?: string
          mime_type: string
          upload_path: string
        }
        Update: {
          announcement_id?: string | null
          created_at?: string | null
          file_name?: string
          file_size?: number
          file_url?: string
          id?: string
          mime_type?: string
          upload_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_assets_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          background_color: string | null
          created_at: string | null
          created_by: string | null
          description: string
          icon_png_url: string | null
          icon_svg_name: string | null
          icon_type: string | null
          id: string
          is_active: boolean | null
          platform_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          background_color?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          icon_png_url?: string | null
          icon_svg_name?: string | null
          icon_type?: string | null
          id?: string
          is_active?: boolean | null
          platform_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          background_color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          icon_png_url?: string | null
          icon_svg_name?: string | null
          icon_type?: string | null
          id?: string
          is_active?: boolean | null
          platform_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_channels: {
        Row: {
          channel_id: string
          created_at: string | null
          display_name: string | null
          id: string
          is_archived: boolean | null
          is_private: boolean | null
          member_count: number | null
          name: string
          purpose: string | null
          topic: string | null
          updated_at: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_archived?: boolean | null
          is_private?: boolean | null
          member_count?: number | null
          name: string
          purpose?: string | null
          topic?: string | null
          updated_at?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_archived?: boolean | null
          is_private?: boolean | null
          member_count?: number | null
          name?: string
          purpose?: string | null
          topic?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      slack_messages: {
        Row: {
          channel_id: string
          created_at: string | null
          deleted_at: string | null
          edited_timestamp: number | null
          id: string
          is_starred: boolean | null
          message_id: string
          message_type: string | null
          parent_user_id: string | null
          permalink: string | null
          reply_count: number | null
          subtype: string | null
          text: string | null
          thread_ts: string | null
          timestamp: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          deleted_at?: string | null
          edited_timestamp?: number | null
          id?: string
          is_starred?: boolean | null
          message_id: string
          message_type?: string | null
          parent_user_id?: string | null
          permalink?: string | null
          reply_count?: number | null
          subtype?: string | null
          text?: string | null
          thread_ts?: string | null
          timestamp?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          deleted_at?: string | null
          edited_timestamp?: number | null
          id?: string
          is_starred?: boolean | null
          message_id?: string
          message_type?: string | null
          parent_user_id?: string | null
          permalink?: string | null
          reply_count?: number | null
          subtype?: string | null
          text?: string | null
          thread_ts?: string | null
          timestamp?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slack_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "slack_channels"
            referencedColumns: ["channel_id"]
          },
          {
            foreignKeyName: "slack_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "slack_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      slack_users: {
        Row: {
          avatar_hash: string | null
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          is_admin: boolean | null
          is_bot: boolean | null
          is_deleted: boolean | null
          is_owner: boolean | null
          real_name: string | null
          status_emoji: string | null
          status_text: string | null
          timezone: string | null
          title: string | null
          updated_at: string | null
          user_id: string
          username: string
        }
        Insert: {
          avatar_hash?: string | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          is_admin?: boolean | null
          is_bot?: boolean | null
          is_deleted?: boolean | null
          is_owner?: boolean | null
          real_name?: string | null
          status_emoji?: string | null
          status_text?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
          username: string
        }
        Update: {
          avatar_hash?: string | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          is_admin?: boolean | null
          is_bot?: boolean | null
          is_deleted?: boolean | null
          is_owner?: boolean | null
          real_name?: string | null
          status_emoji?: string | null
          status_text?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
