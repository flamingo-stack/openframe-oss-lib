import { UserProfile } from './user';
import { Vendor, VendorPricing } from './vendor';
import { RealCategory } from './categories';

// Selection source enum – indicates whether the vendor selection was AI-generated or manually selected
export type SelectionSource = 'ai' | 'manual' | 'placeholder' | 'unknown';

// Defines the role of a vendor in the MSP stack selector.
// "current"   – the vendor the MSP is using today.
// "alternative" – the potential replacement/open-source option.
export type StackVendorType = 'current' | 'alternative';

// MSP (Managed Service Provider) interface
export interface MSP {
  id: string;
  name: string;
  icon_url?: string;
  seat_count: number;
  technician_count?: number | null;
  annual_revenue?: number | null;

  // Case study fields
  website?: string | null;
  industry?: string | null;
  description?: string | null;
  location?: string | null;
  company_size?: 'small' | 'midmarket' | 'enterprise' | 'enterprise_1000+' | null;
  founded_year?: number | null;
  specialties?: string[] | null;
  certifications?: string[] | null;

  created_at: string;
  updated_at: string;
}

// Extended Vendor for stack-specific data
export interface StackVendor extends Omit<Vendor, 'selection_source'> {
  vendor_type: StackVendorType;
  selection_source: SelectionSource; // 'ai' (automatic) or 'manual' (user choice)
  stack_position?: {
    category_slug: string;
    subcategory_slug: string;
  };
  pricing_for_seats?: VendorPricing; // Calculated pricing based on seat count
}

// Core stack interface - using slugs
export interface UserStack {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  /** Visibility flag - true if the stack is publicly shareable */
  is_public?: boolean;
  share_token?: string;
  msp?: MSP;
  vendor_selections: StackVendorSelection[];
  created_at: string;
  updated_at: string;
}

// Vendor selection within a stack - using slugs
export interface StackVendorSelection {
  id: string;
  stack_id: string;
  category_slug: string;
  subcategory_slug: string;
  vendor_slug: string;
  vendor_type: StackVendorType;
  selection_source?: SelectionSource; // 'ai' (automatic) or 'manual' (user choice)
  // Optional numeric identifiers used on the server-side cost calculator
  category_id?: number;
  subcategory_id?: number;
  vendor_id?: number;
  vendor?: Vendor; // Populated vendor data
  notes?: string;
  priority?: number; // For ordering within subcategory
  created_at: string;
  updated_at: string;
}

// Request/Response types for API
export interface CreateStackRequest {
  name: string;
  description?: string;
  msp_id?: string;
  is_public?: boolean;
}

export interface UpdateStackRequest {
  name?: string;
  description?: string;
  msp_id?: string;
  is_public?: boolean;
}

export interface AddVendorToStackRequest {
  category_slug: string;
  subcategory_slug: string;
  vendor_slug: string;
  vendor_type: StackVendorType;
  selection_source?: SelectionSource;
  notes?: string;
  priority?: number;
}

export interface UpdateStackVendorRequest {
  vendor_slug?: string;
  vendor_type?: StackVendorType;
  selection_source?: SelectionSource;
  notes?: string;
  priority?: number;
}

// Category with subcategories and vendor selections
export interface StackCategory extends RealCategory {
  vendor_selections: StackVendorSelection[];
}

// Subcategory with vendor selections
export interface StackSubcategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  vendor_selections: StackVendorSelection[];
}

// Stack statistics
export interface StackStats {
  total_vendors: number;
  commercial_vendors: number;
  opensource_vendors: number;
  categories_covered: number;
  estimated_monthly_cost?: number;
}

// Stack sharing and collaboration
export interface StackShare {
  id: string;
  stack_id: string;
  shared_by_user_id: string;
  shared_with_user_id?: string; // null for public shares
  share_token: string;
  permissions: 'view' | 'comment' | 'edit';
  expires_at?: string;
  created_at: string;
}

// Stack templates
export interface StackTemplate {
  id: string;
  name: string;
  description: string;
  category: string; // e.g., 'small-business', 'enterprise', 'startup'
  vendor_selections: Omit<StackVendorSelection, 'id' | 'stack_id' | 'created_at' | 'updated_at'>[];
  created_by_user_id: string;
  is_public: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

// Export types for external use
export type {
  UserProfile,
  Vendor,
  VendorPricing,
  RealCategory
};

// Cost calculation interfaces (use slugs for identification)
export interface StackCostCalculation {
  /** Total cost of all current vendors (commercial or OSS) */
  total_current_cost: number;
  /** Total cost of all alternatives (after migration) */
  total_alternative_cost: number;

  total_savings: number;
  savings_percentage: number;
  cost_per_seat: number;
  margin_increase_percentage: number;
  monthly_savings: number;
  annual_savings: number;
  
  // Breakdown by category
  category_breakdowns: CategoryCostBreakdown[];
}

export interface CategoryCostBreakdown {
  category_slug: string;
  category_name: string;
  current_cost: number;
  alternative_cost: number;

  savings: number;
  savings_percentage: number;
  
  // Subcategory details
  subcategory_breakdowns: SubcategoryCostBreakdown[];
}

export interface SubcategoryCostBreakdown {
  subcategory_slug: string;
  subcategory_name: string;
  commercial_vendor?: StackVendor;
  opensource_vendor?: StackVendor;
  commercial_cost: number;
  opensource_cost: number;
  savings: number;
  has_selection: boolean;
}

// Margin analysis interface
export interface MarginAnalysis {
  current_margin_percentage: number;
  improved_margin_percentage: number;
  margin_increase: number;
  monthly_additional_profit: number;
  annual_additional_profit: number;
  roi_timeframe_months: number;
}

// API request/response interfaces (updated to use slugs)
export interface CreateMSPRequest {
  name: string;
  icon_url?: string;
  seat_count: number;
  technician_count?: number | null;
  annual_revenue?: number | null;
}

export interface UpdateMSPRequest extends Partial<CreateMSPRequest> {}

export interface StackVendorSelectionRequest {
  category_slug: string;
  subcategory_slug: string;
  vendor_slug: string;
  vendor_type: StackVendorType;
  selection_source?: SelectionSource; // 'ai' (automatic) or 'manual'
  // Server-side helpers (optional) – used internally when IDs are already known
  category_id?: number;
  subcategory_id?: number;
  vendor_id?: number;
}

export interface ShareStackRequest {
  is_public: boolean;
  expires_at?: string;
}

export interface StackListResponse {
  stacks: UserStack[];
  total_count: number;
  has_more: boolean;
}

export interface StackDetailResponse {
  stack: UserStack;
  cost_analysis: StackCostCalculation;
  margin_analysis: MarginAnalysis;
}

// Component prop interfaces (updated to use slugs)
export interface CategoryVendorSelectorProps {
  category: RealCategory;
  stackId: string;
  currentSelections: StackVendorSelection[];
  seatCount: number;
  onVendorSelect: (selection: StackVendorSelectionRequest) => void;
  onVendorRemove: (categorySlug: string, subcategorySlug: string, vendorType: StackVendorType) => void;
  onCategoryToggle: (categorySlug: string, isHidden: boolean) => void;
}

export interface SubcategoryVendorSectionProps {
  subcategory: RealCategory;
  category: RealCategory;
  seatCount: number;
  commercialSelection?: StackVendorSelection;
  opensourceSelection?: StackVendorSelection;
  onVendorSelect: (selection: StackVendorSelectionRequest) => void;
  onVendorRemove: (categorySlug: string, subcategorySlug: string, vendorType: StackVendorType) => void;
  onCompare: (commercialVendor?: StackVendor, opensourceVendor?: StackVendor) => void;
}

export interface MarginIncreaseComponentProps {
  costAnalysis: StackCostCalculation;
  marginAnalysis: MarginAnalysis;
  isLoading?: boolean;
}

export interface StackBuilderProps {
  stack?: UserStack;
  msp?: MSP;
  categories: RealCategory[];
  isEditing?: boolean;
  onSave: (stackData: CreateStackRequest | UpdateStackRequest) => void;
  onShare: (shareData: ShareStackRequest) => void;
  onMSPUpdate: (mspData: CreateMSPRequest | UpdateMSPRequest) => void;
}

// Utility type for vendor selection state (using slugs)
export type VendorSelectionState = {
  [categorySlug: string]: {
    [subcategorySlug: string]: {
      commercial?: StackVendorSelection;
      opensource?: StackVendorSelection;
    };
  };
};

// Export options and filter interfaces
export interface CostCalculationOptions {
  seat_count: number;
  include_implementation_costs?: boolean;
  include_training_costs?: boolean;
  msp_markup_percentage?: number;
}

export interface StackVendorFilterOptions {
  category_slug?: string;
  subcategory_slug?: string;
  vendor_type?: StackVendorType;
  pricing_model?: string;
  min_price?: number;
  max_price?: number;
  sort_by?: 'openmsp_score' | 'github_stars' | 'pricing' | 'name';
  sort_order?: 'asc' | 'desc';
} 