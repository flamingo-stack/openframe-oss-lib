import type { RealCategory } from './categories';
import type { Vendor } from './vendor';

export interface CategoryCardProps {
  category: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    icon_url?: string;
    iconUrls: string[];
    subcategory_count?: number;
    categoryCount?: number;
    productCount?: number;
  };
  vendorCount?: number;
  subcategoryCount?: number;
  index?: number;
  className?: string;
}

export interface RealCategoryCardProps {
  category: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    icon_url?: string;
  };
  vendorCount?: number;
  subcategoryCount?: number;
  vendors?: Vendor[];
  isLoading?: boolean;
  /**
   * The vendors the host reads for the card's strip (its fetch limit): the vendor icons the loading card draws.
   * Default `CATEGORIES_CART_SKELETON_VENDORS`.
   */
  vendorLimit?: number;
  isLoadingVendorCount?: boolean;
  isLoadingSubcategoryCount?: boolean;
  className?: string;
}

export interface CategoryData {
  data: RealCategory[];
  isLoading: boolean;
  /** Whatever the fetch layer threw — narrow at the point of display. */
  error: unknown;
  vendors: Vendor[];
  loading: boolean;
}
