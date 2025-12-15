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
  vendors?: any[];
  isLoading?: boolean;
  isLoadingVendorCount?: boolean;
  isLoadingSubcategoryCount?: boolean;
  className?: string;
}

export interface CategoryData {
  data: any[];
  isLoading: boolean;
  error: any;
  vendors: any[];
  loading: boolean;
}