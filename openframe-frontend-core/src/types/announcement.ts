// Announcement system TypeScript types
import type { PlatformName, PlatformRecord, LegacyPlatform, PlatformFilter } from './platform';

// For backward compatibility, maintain the old Platform type temporarily
export type Platform = LegacyPlatform;
export type IconType = 'svg' | 'png';

// Database Models
export interface Announcement {
  id: string;
  title: string;
  description: string;
  background_color: string;
  icon_type: IconType;
  icon_svg_name?: string;
  icon_png_url?: string;
  /** Extra props for the main bar/icon */
  icon_svg_props?: Record<string, any>;
  platform_id: string;  // Foreign key to platforms table
  platform?: PlatformRecord;  // Joined platform data
  is_active: boolean;
  // CTA (Call-To-Action) fields
  cta_enabled?: boolean;
  cta_text?: string;
  cta_icon?: string;
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
  icon_type: IconType;
  icon_svg_name?: string;
  icon_png_url?: string;
  /** Extra props for the main bar/icon */
  icon_svg_props?: Record<string, any>;
  platform_id: string;  // Foreign key to platforms table
  is_active?: boolean;
  // CTA (Call-To-Action) fields
  cta_enabled?: boolean;
  cta_text?: string;
  cta_icon?: string;
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
  icon_type?: IconType;
  icon_svg_name?: string;
  icon_png_url?: string;
  /** Extra props for the main bar/icon */
  icon_svg_props?: Record<string, any>;
  platform_id?: string;  // Foreign key to platforms table
  is_active?: boolean;
  // CTA (Call-To-Action) fields
  cta_enabled?: boolean;
  cta_text?: string;
  cta_icon?: string;
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
    platform?: Platform;
    is_active?: boolean;
  };
}

export interface AnnouncementResponse {
  announcement: Announcement;
}

// Form Data Types
export interface AnnouncementFormData {
  title: string;
  description: string;
  background_color: string;
  icon_type: IconType;
  icon_svg_name: string;
  icon_png_file?: File;
  platform_id: string;  // Foreign key to platforms table
  is_active: boolean;
  // CTA (Call-To-Action) fields
  cta_enabled: boolean;
  cta_text: string;
  cta_icon: string;
  cta_show_icon: boolean;
  cta_url: string;
  cta_target: '_self' | '_blank';
  // New CTA button custom colors
  cta_button_background_color?: string;
  cta_button_text_color?: string;
  cta_icon_props?: string; // JSON string in form
  /** Extra props for the main bar/icon */
  icon_svg_props?: string;
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
  icon_svg_name: {
    required: boolean;
    validOptions: string[];
  };
  platform: {
    required: boolean;
    validOptions: Platform[];
  };
}

// Platform Configuration
export interface PlatformConfig {
  name: string;
  display_name: string;
  default_color: string;
  default_icon: string;
}

// Admin Dashboard Types
export interface AnnouncementStats {
  total_announcements: number;
  active_announcements: number;
  announcements_by_platform: Record<Platform, number>;
  recent_announcements: Announcement[];
}

// Component Props Types
export interface AnnouncementBarProps {
  announcement?: Announcement;
  onDismiss?: (announcementId: string) => void;
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
  platform?: Platform;
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
export const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    name: 'openframe',
    display_name: 'OpenFrame',
    default_color: 'var(--ods-open-yellow-base)',     // CSS variable instead of hex
    default_icon: 'openframe-logo'
  },
  {
    name: 'openmsp',
    display_name: 'OpenMSP',
    default_color: 'var(--ods-open-yellow-base)',     // CSS variable instead of hex
    default_icon: 'openmsp-logo'
  },
  {
    name: 'flamingo',
    display_name: 'Flamingo',
    default_color: 'var(--ods-flamingo-pink-base)',   // CSS variable instead of hex
    default_icon: 'flamingo-logo'
  }
];

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