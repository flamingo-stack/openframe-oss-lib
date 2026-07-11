// Announcement system TypeScript types
import type { LegacyPlatform, PlatformFilter } from './platform';
import type { EntityPlatformAssoc } from './entity-platform';

// Database Models
export interface Announcement {
  id: string;
  title: string;
  description: string;
  background_color: string;
  icon_name?: string;
  icon_url?: string;
  /** Extra props for the main bar/icon */
  icon_props?: Record<string, any>;
  /** Hydrated entity_platforms associations (featured-first) — what the hub
   *  DAL's attachPlatformsToRow(s) emits. No singular platform/platform_id. */
  announcement_platforms?: EntityPlatformAssoc[];
  is_active: boolean;
  // CTA (Call-To-Action) fields
  cta_enabled?: boolean;
  cta_text?: string;
  cta_icon_name?: string;
  cta_show_icon?: boolean;
  cta_url?: string;
  cta_target?: '_self' | '_blank';
  // Custom CTA button colors (hex codes like #FFFFFF). Optional.
  cta_button_background_color?: string | null;
  cta_button_text_color?: string | null;
  /** Additional props to spread onto the CTA icon component */
  cta_icon_props?: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  created_by_user?: {
    id: string;
    email: string;
    full_name?: string;
  };
  announcement_assets?: AnnouncementAsset[];
}

export interface AnnouncementAsset {
  id: string;
  announcement_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  upload_path: string;
  created_at: string;
}

// API Request/Response Types
export interface CreateAnnouncementData {
  title: string;
  description: string;
  background_color: string;
  icon_name?: string;
  icon_url?: string;
  /** Extra props for the main bar/icon */
  icon_props?: Record<string, any>;
  platforms?: string[];  // entity_platforms set (multi-select)
  is_active?: boolean;
  // CTA (Call-To-Action) fields
  cta_enabled?: boolean;
  cta_text?: string;
  cta_icon_name?: string;
  cta_show_icon?: boolean;
  cta_url?: string;
  cta_target?: '_self' | '_blank';
  cta_button_background_color?: string;
  cta_button_text_color?: string;
  cta_icon_props?: Record<string, any>;
  created_by: string;
}

export interface UpdateAnnouncementData {
  title?: string;
  description?: string;
  background_color?: string;
  icon_name?: string;
  icon_url?: string;
  /** Extra props for the main bar/icon */
  icon_props?: Record<string, any>;
  platforms?: string[];  // entity_platforms set (multi-select)
  is_active?: boolean;
  // CTA (Call-To-Action) fields
  cta_enabled?: boolean;
  cta_text?: string;
  cta_icon_name?: string;
  cta_show_icon?: boolean;
  cta_url?: string;
  cta_target?: '_self' | '_blank';
  cta_button_background_color?: string;
  cta_button_text_color?: string;
  cta_icon_props?: Record<string, any>;
}

export interface AnnouncementListResponse {
  announcements: Announcement[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
  };
  filters?: {
    platform?: LegacyPlatform;
    is_active?: boolean;
  };
}

/**
 * Wire shape of GET /api/announcements/active — the single typed home for the
 * `{ announcement }` envelope (hub route return + AnnouncementBar's
 * useSelfFetch generic). `null` when no active announcement exists.
 */
export interface AnnouncementResponse {
  announcement: Announcement | null;
}

/**
 * Default CTA button colors — one home for the pair the DAL create/update
 * defaults and the admin form both reference. Announcement colors are
 * admin-chosen data (not ODS-token surfaces) by design.
 */
export const ANNOUNCEMENT_CTA_DEFAULTS = {
  background: '#1A1A1A',
  text: '#FAFAFA',
} as const;

// Form Data Types
export interface AnnouncementFormData {
  title: string;
  description: string;
  background_color: string;
  icon_name: string;
  icon_url?: string;
  platforms: string[];  // entity_platforms set (multi-select; no single platform_id)
  is_active: boolean;
  // CTA (Call-To-Action) fields
  cta_enabled: boolean;
  cta_text: string;
  cta_icon_name: string;
  cta_show_icon: boolean;
  cta_url: string;
  cta_target: '_self' | '_blank';
  // New CTA button custom colors
  cta_button_background_color?: string;
  cta_button_text_color?: string;
  cta_icon_props?: string; // JSON string in form
  /** Extra props for the main bar/icon */
  icon_props?: string;
}

// API Query Parameters
export interface GetAnnouncementsOptions {
  platform?: PlatformFilter;  // Changed from Platform to PlatformFilter to include 'all'
  is_active?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'created_at' | 'updated_at' | 'title';
  sortOrder?: 'asc' | 'desc';
}

// File Upload Types
export interface IconUploadResponse {
  success: boolean;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  error?: string;
}

export interface IconUploadData {
  file: File;
  announcement_id?: string;
}

// Available SVG Icons (extend as needed)
export interface AvailableSvgIcon {
  name: string;
  display_name: string;
  component_name: string;
}

// Error Types
export interface AnnouncementError {
  code: string;
  message: string;
  details?: string;
}

// Validation Types
export interface AnnouncementValidation {
  title: {
    required: boolean;
    minLength: number;
    maxLength: number;
  };
  description: {
    required: boolean;
    minLength: number;
    maxLength: number;
  };
  background_color: {
    required: boolean;
    pattern: RegExp;
  };
  icon_name: {
    required: boolean;
    validOptions: string[];
  };
  platform: {
    required: boolean;
    validOptions: LegacyPlatform[];
  };
}

// Import unified platform configuration (removed duplicate definition)
export type { PlatformConfig } from './platform';

// Admin Dashboard Types
export interface AnnouncementStats {
  total_announcements: number;
  active_announcements: number;
  announcements_by_platform: Record<LegacyPlatform, number>;
  recent_announcements: Announcement[];
}

// Component Props Types
export interface AnnouncementBarProps {
  /**
   * SSR mode seed. `null` = the server resolved "nothing to show" (no active
   * announcement, or dismissed via cookie) — seeds the fetch hook and skips
   * the mount fetch. Absent (`undefined`) = client-only mode: the bar
   * self-fetches on mount (see `announcementsUrl`).
   */
  initialAnnouncement?: Announcement | null;
  /**
   * Client-only mode fetch URL for hosts WITHOUT SSR and without an
   * EndpointsRuntime provider (bare React apps: Vite/CRA embeds). Takes
   * precedence over the provider's `announcementsUrl`. With neither prop nor
   * provider, the bar renders nothing and never fetches (silent no-op).
   */
  announcementsUrl?: string;
  /**
   * Dismissal-namespace platform for hosts where NEXT_PUBLIC_APP_TYPE is not
   * available at runtime (non-Next embeds). Defaults to `getAppType()`.
   */
  platform?: string;
  /**
   * Render-only mode for the admin live preview: no fetch/revalidation, inert
   * dismiss button, and no storage side effects (never writes dismissal
   * cookies or touches localStorage).
   */
  previewMode?: boolean;
  className?: string;
}

export interface AnnouncementFormProps {
  announcement?: Announcement;
  onSubmit: (data: AnnouncementFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  availableIcons: AvailableSvgIcon[];
}

export interface AnnouncementListProps {
  announcements: Announcement[];
  onEdit: (announcement: Announcement) => void;
  onDelete: (announcementId: string) => void;
  onToggleActive: (announcementId: string, isActive: boolean) => void;
  isLoading?: boolean;
}

// Database Utility Types
export interface AnnouncementFilters {
  platform?: LegacyPlatform;
  is_active?: boolean;
  created_by?: string;
  search?: string;
}

export interface AnnouncementSortOptions {
  field: 'created_at' | 'updated_at' | 'title' | 'platform';
  direction: 'asc' | 'desc';
}

// SVG Icon Type
export interface SvgIcon {
  name: string;
  label: string;
  component: any;
}

// Platform display configuration
// PLATFORM_CONFIGS removed - all platform data now comes from database via getPlatformsConfig()

// Available SVG icons configuration
export const AVAILABLE_SVG_ICONS: SvgIcon[] = [
  // OpenFrame Logo Options
  { name: 'openframe-logo', label: 'OpenFrame Logo', component: null as any },
  
  // Platform Logos
  { name: 'openmsp-logo', label: 'OpenMSP Logo', component: null as any },
  { name: 'flamingo-logo', label: 'Flamingo Logo', component: null as any },
  
  // Lucide Icons
  { name: 'megaphone', label: 'Megaphone', component: null as any },
  { name: 'bell', label: 'Bell', component: null as any },
  { name: 'info', label: 'Information', component: null as any },
  { name: 'star', label: 'Star', component: null as any },
  { name: 'rocket', label: 'Rocket', component: null as any },
  { name: 'package', label: 'Package', component: null as any }
]; 