/**
 * Vendor Link Types
 * Normalized link management for vendors
 */

export type VendorLinkType = 
  | 'website'
  | 'github_repo'
  | 'docs'
  | 'twitter'
  | 'linkedin'
  | 'youtube'
  | 'discord'
  | 'slack'
  | 'support'
  | 'blog'
  | 'demo'
  | 'pricing';

/**
 * Vendor Link Database Record
 */
export interface VendorLink {
  id: string;
  vendor_id: number;
  link_type: VendorLinkType;
  link_url: string;
  link_title?: string | null;
  is_primary: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Vendor Link for creation/updates
 */
export interface VendorLinkInput {
  vendor_id: number;
  link_type: VendorLinkType;
  link_url: string;
  link_title?: string;
  is_primary?: boolean;
  display_order?: number;
}

/**
 * Vendor Links grouped by type
 */
export type VendorLinksGrouped = Partial<Record<VendorLinkType, VendorLink[]>>;

/**
 * Link display configuration
 */
export interface LinkDisplayConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  priority: number; // For default ordering
}

/**
 * Complete vendor with both old and new link systems
 * This allows transition period where both systems work
 */
export interface VendorWithLinks {
  // Basic vendor properties
  id: number;
  title: string;
  slug: string;
  description?: string | null;
  about?: string | null;
  is_open_source?: boolean;
  is_verified?: boolean | null;
  openmsp_rating?: number | null;
  pricing_model?: string | null;
  github_stars?: number | null;
  github_forks?: number | null;
  github_license?: string | null;
  github_last_commit?: string | null;
  sub_cat_id?: number | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
  last_updated?: string | null;
  openframe_recommendation?: boolean | null;
  price?: string | null;
  
  // Legacy link columns (actual columns that exist in database)
  website?: string | null;
  repository?: string | null;
  other_link?: string | null;
  
  // New normalized links
  vendor_links?: VendorLink[];
}

/**
 * Utility type for getting links with fallback to legacy columns
 */
export interface VendorLinkFallback {
  url: string;
  title?: string;
  type: VendorLinkType;
  source: 'new' | 'legacy'; // Track where the link came from
} 