import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { VendorIcon } from './vendor-icon';
import type { CategoryCardProps, RealCategoryCardProps } from '../types/category';


// Component that receives vendor and subcategory data as props
export function CategoriesCart({ 
  category, 
  vendors = [], 
  vendorCount = 0, 
  subcategoryCount = 0, 
  isLoading = false,
  className = '' 
}: RealCategoryCardProps) {
  console.log('🔍 CategoriesCart rendering for category:', category.slug, 'with props:', {
    vendorsLength: vendors?.length,
    vendorCount,
    subcategoryCount,
    isLoading
  });

  return (
    <Link
      href={`/vendors?category=${category.slug}`}
      className={`block bg-ods-card border border-ods-border rounded-lg p-3 md:p-4 pb-4 md:pb-6 hover:border-[#FFC008] transition-colors group relative ${className}`}
    >
      <div className="flex flex-col gap-4 md:gap-6">
        {/* Vendor Icons Grid */}
        <div className="relative w-full h-8 md:h-10 overflow-hidden">
          <div className="flex gap-2 md:gap-3 w-full">
            {isLoading ? (
              // Skeleton loading for vendor icons
              Array.from({ length: 20 }).map((_, index) => (
                <div
                  key={index}
                  className="w-8 h-8 md:w-10 md:h-10 bg-ods-border rounded animate-pulse flex-shrink-0"
                />
              ))
            ) : vendors && vendors.length > 0 ? (
              vendors.map((vendor: any) => (
                <VendorIcon
                  key={vendor.id}
                  vendor={vendor}
                  size="md"
                  className="rounded overflow-hidden filter grayscale opacity-60"
                />
              ))
            ) : (
              // No vendors found - show placeholder icons
              Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="w-8 h-8 md:w-10 md:h-10 bg-ods-border rounded flex items-center justify-center opacity-30 flex-shrink-0"
                >
                  <div className="w-4 h-4 md:w-6 md:h-6 bg-[#888888] rounded-sm" />
                </div>
              ))
            )}
          </div>

          {/* Gradient overlays for fade effect */}
          <div className="absolute inset-y-0 left-0 w-4 md:w-6 bg-gradient-to-r from-[#212121] to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-4 md:w-6 bg-gradient-to-l from-[#212121] to-transparent pointer-events-none" />
        </div>

        {/* Category Information - Updated to use real data */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl md:text-2xl font-bold text-ods-text-primary group-hover:text-ods-accent transition-colors leading-[1.33] font-body">
              {category.name}
            </h3>
            <p className="text-sm md:text-base font-medium text-ods-text-secondary leading-[1.43] font-body">
              {subcategoryCount || 0} Subcategories • {vendorCount || 0} Products
            </p>
          </div>

          <div className="flex items-start md:items-end justify-between gap-4 md:gap-6">
            <p className="font-['DM_Sans'] font-medium text-lg leading-[1.33] text-ods-text-primary flex-1">
              {category.description}
            </p>

            {/* Arrow Button */}
            <div
              className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-transparent border border-ods-border rounded-md group-hover:bg-[#FFC008] transition-colors flex-shrink-0"
              aria-label={`View ${category.name} category`}
            > 
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-ods-text-primary group-hover:text-black transition-colors" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

