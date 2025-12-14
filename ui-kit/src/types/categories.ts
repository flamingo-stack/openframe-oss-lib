import { ReactNode } from 'react';

export interface Category {
  id: string;
  title: string;
  description: string;
  subcategoriesCount: number;
  productsCount: number;
  iconUrls: string[];
  slug: string;
}

// Legacy category interface for backward compatibility  
export interface CategoryCardProps {
  category: {
    name: string;
    description: string;
    categoryCount: number;
    productCount: number;
    iconUrls: string[];
  };
  className?: string;
}

// Real category interface that matches the database structure
export interface RealCategory {
  id: number;
  name: string;
  slug: string;
  description: string; // Made required since we're adding real descriptions
  created_at?: string;
  vendor_subcategory: {
    id: number;
    name: string;
    slug: string;
    description?: string;
  }[];
}

// Props for the real category card component
export interface RealCategoryCardProps {
  category: RealCategory;
  className?: string;
}

// Category data with vendor count for display
export interface CategoryWithStats extends RealCategory {
  vendorCount: number;
  subcategoryCount: number;
} 