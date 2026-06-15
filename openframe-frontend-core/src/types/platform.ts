// Unified Platform Types
// Used across announcements, blog posts, and platform configuration

export type PlatformName = 'openmsp' | 'tmcg' | 'flamingo' | 'flamingo-teaser' | 'universal' | 'marketing-hub' | 'product-hub' | 'revenue-hub' | 'people-hub' | 'openframe' | 'company-hub';

// Database Platform Model (from platforms table)
export interface PlatformRecord {
  id: string;
  name: PlatformName;
  display_name: string;
  description?: string;
  is_active: boolean;
  is_internal: boolean; // Whether this is an internal admin platform vs public-facing
  // Universal-viewer: when true, content DALs return ALL platforms' rows (applyFilter=false),
  // decoupled from is_internal. Read by getPlatformContentScopeMode (hub lib/platform-utils.ts).
  serves_all_content: boolean;
  // When false, skip activity-tracking + HubSpot sync for this platform's principals
  // (formerly keyed on is_internal). Read by platformTracksActivity (hub lib/platform-utils.ts).
  tracks_activity: boolean;
  // Chat (Ask AI) wiring — populated only for platforms that host a chat surface.
  // `chat_source_id` is the doc-source binding (`chat_admin_personas.chat_source_id`).
  // `chat_source_rag_tables_version` is the per-platform RAG-table override version
  //   bumped by the `replace_chat_source_rag_tables` RPC; used for cross-Lambda
  //   cache invalidation in `lib/data/doc-source-config-utils.ts`.
  // `chat_enabled` is the platform-wide chat kill switch (NOT NULL DEFAULT true).
  chat_source_id?: string | null;
  chat_source_rag_tables_version?: number | null;
  chat_enabled?: boolean | null;
  created_at: string;
  updated_at: string;
}

// Platform Configuration for API
export interface PlatformConfig {
  id: string;  // UUID from database (required)
  value: string;  // same as name
  label: string;  // same as display_name
  name: string;   // same as name
  display_name: string;
  default_color: string;
  default_icon: string;
  description: string;
}

// Platform Option for dropdowns/filters
export interface PlatformOption {
  value: string;
  label: string;
}

// Platform filter types
export type PlatformFilter = PlatformName | 'all';

// Legacy type aliases for backward compatibility
export type LegacyPlatform = 'tmcg' | 'openmsp' | 'flamingo';

// Platform statistics
export interface PlatformStats {
  platform: PlatformName;
  display_name: string;
  announcement_count: number;
  blog_post_count: number;
  is_active: boolean;
} 