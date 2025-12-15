/**
 * Vendor media item
 */
export interface VendorMedia {
  media_type: 'logo' | 'image' | 'video';
  media_url: string;
}

/**
 * Vendor pricing information
 */
export interface VendorPricing {
  id: number;
  vendor_id: number;
  model: string | null;
  price: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Vendor GitHub information
 */
export interface VendorGithub {
  id: number;
  vendor_id: number;
  github_stars: number | null;
  github_forks: number | null;
  github_commits: number | null;
  github_license: string | null;
  github_last_commit: string | null;
  github_score: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Vendor classification
 */
export interface VendorClassification {
  id: number;
  vendor_id: number;
  classification: 'open_source' | 'commercial' | 'openframe_selected';
  created_at: string;
  updated_at: string;
}

/**
 * Vendor search result type
 */
export type VendorSearchResult = {
  id: number
  title: string
  slug: string
  vendor_media?: VendorMedia[]
  description: string | null
}

/**
 * Complete Vendor type (normalized schema only)
 */
export interface Vendor {
  id: number
  title: string
  slug: string
  description: string | null
  about: string | null
  openmsp_impact_score: number | null
  openmsp_score: number | null
  created_at: string
  updated_at: string
  last_updated: string
  created_by: string | null
  updated_by: string | null
  
  // Relations to normalized tables (many-to-many subcategories)
  vendor_subcategories?: Array<{
    subcategory_id: number
    vendor_subcategory?: VendorSubcategory | null
  }> | null
  vendor_media: VendorMedia[]
  vendor_pricing?: VendorPricing[]
  vendor_github?: VendorGithub | null
  vendor_classification?: VendorClassification[]
  /**
   * Indicates whether this vendor was selected automatically by AI or manually
   * by the user in stack-building flows. Not stored in the core vendors table
   * but propagated into client-side objects for UI badges.
   */
  selection_source?: 'ai' | 'manual'
}

/**
 * Comparison views now use the full Vendor type. We provide an alias so existing
 * code that references `VendorForComparison` continues to work.
 */
export type VendorForComparison = Vendor;

/**
 * Pros and cons item
 */
export type ProsConsItem = {
  id: number
  description: string
}

/**
 * Vendor pros and cons
 */
export type VendorProsCons = {
  pros: ProsConsItem[]
  cons: ProsConsItem[]
}

/**
 * Subcategory feature type
 */
export type SubcategoryFeature = {
  id: string
  subcategory_id: number
  name: string
  description: string | null
  importance: "Critical" | "Important" | "Nice-to-have"
  display_order: number
}

/**
 * Vendor feature value type
 */
export type VendorFeatureValue = {
  id: string
  vendor_id: number
  subcategory_id: string
  feature_value: boolean
  display_value: string | null
  notes: string | null
  feature?: SubcategoryFeature
}

/**
 * Enhanced vendor feature for display
 */
export type EnhancedVendorFeature = {
  id: string
  name: string
  description: string | null
  importance: "Critical" | "Important" | "Nice-to-have"
  display_order: number
  subcategory_id: number | null
  feature_value: boolean
  display_value: string | null
  notes: string | null
}

/**
 * Detailed vendor feature with category and subcategory information
 */
export interface DetailedVendorFeature {
  id: number
  featureId: number
  vendorId: number
  featureValue: boolean
  displayValue: string | null
  notes: string | null
  name: string
  description: string | null
  importance: "Critical" | "Important" | "Nice-to-have"
  displayOrder: number
  subcategoryId: number
  subcategoryName: string
  categoryId: number
  categoryName: string
}

/**
 * Related vendor feature for comparison
 */
export type RelatedVendorFeature = {
  featureId: string
  featureName: string
  featureDescription: string | null
  importance: "Critical" | "Important" | "Nice-to-have"
  currentVendorHasFeature: boolean
  vendorsWithFeature: VendorSearchResult[]
  vendorsWithoutFeature: VendorSearchResult[]
  comparisonType: "advantage" | "disadvantage" | "neutral"
  displayValue: string | null
}

/**
 * Related feature from other vendors
 */
export type RelatedFeature = {
  id: string
  name: string
  description: string | null
  importance: "Critical" | "Important" | "Nice-to-have"
  vendors: VendorSearchResult[]
  displayValue: string | null
  notes: string | null
}

/**
 * Category with subcategories and features
 */
export type CategoryWithFeatures = {
  [categoryId: number]: {
    id: number
    name: string
    subcategories: {
      [subcategoryId: number]: SubcategoryWithFeatures
    }
  }
}

/**
 * Subcategory with features
 */
export type SubcategoryWithFeatures = {
  id: number
  name: string
  features: {
    [featureId: string]: FeatureWithVendors
  }
}

/**
 * Feature with vendor data
 */
export type FeatureWithVendors = {
  id: string
  name: string
  description: string | null
  importance: "Critical" | "Important" | "Nice-to-have"
  display_order: number
  vendors: {
    [vendorId: number]: VendorFeatureData
  }
}

/**
 * Vendor feature data
 */
export type VendorFeatureData = {
  feature_value: boolean
  display_value: string | null
  notes: string | null
}

/**
 * Vendor subcategory
 */
export interface VendorSubcategory {
  id: number;
  name: string;
  slug: string;
  vendor_category?: {
    id: number;
    name: string;
    slug: string;
  } | null;
}
