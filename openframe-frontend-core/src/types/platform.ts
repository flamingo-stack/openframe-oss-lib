// Unified Platform Types
// Used across announcements, blog posts, and platform configuration

export type PlatformName = 'openmsp' | 'tmcg' | 'flamingo' | 'flamingo-teaser' | 'universal' | 'admin-hub' | 'openframe';

// Database Platform Model (from platforms table)
export interface PlatformRecord {
  id: string;
  name: PlatformName;
  display_name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Platform Configuration for API
export interface PlatformConfig {
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