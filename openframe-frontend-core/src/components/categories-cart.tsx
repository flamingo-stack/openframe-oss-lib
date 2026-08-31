'use client';

import { ChevronRight } from 'lucide-react';
import Link from '../embed-shims/next-link';
import type { RealCategoryCardProps } from '../types/category';
import { VendorIcon } from './vendor-icon';

// Component that receives vendor and subcategory data as props
export function CategoriesCart({
  category,
  vendors = [],
  vendorCount = 0,
  subcategoryCount = 0,
  isLoading = false,
  className = '',
}: RealCategoryCardProps) {
  return (
    <Link
      href={`/vendors?category=${category.slug}`}
      className={`group relative block rounded-lg border border-ods-border bg-ods-card p-3 pb-4 transition-colors hover:border-ods-accent md:p-4 md:pb-6 ${className}`}
    >
      <div className="flex flex-col gap-4 md:gap-6">
        {/* Vendor Icons Grid */}
        <div className="relative h-8 w-full overflow-hidden md:h-10">
          <div className="flex w-full gap-2 md:gap-3">
            {isLoading
              ? // Skeleton loading for vendor icons
                Array.from({ length: 20 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-8 w-8 flex-shrink-0 animate-pulse rounded bg-ods-border md:h-10 md:w-10"
                  />
                ))
              : vendors && vendors.length > 0
                ? vendors.map(vendor => (
                    <VendorIcon
                      key={vendor.id}
                      vendor={vendor}
                      size="md"
                      className="overflow-hidden rounded opacity-60 grayscale filter"
                    />
                  ))
                : // No vendors found - show placeholder icons
                  Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-ods-border opacity-30 md:h-10 md:w-10"
                    >
                      <div className="h-4 w-4 rounded-sm bg-ods-skeleton md:h-6 md:w-6" />
                    </div>
                  ))}
          </div>

          {/* Gradient overlays for fade effect */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-[#212121] to-transparent md:w-6" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-[#212121] to-transparent md:w-6" />
        </div>

        {/* Category Information - Updated to use real data */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-ods-text-primary transition-colors text-h3 group-hover:text-ods-accent">
              {category.name}
            </h3>
            <p className="text-ods-text-secondary text-h6">
              {subcategoryCount || 0} Subcategories • {vendorCount || 0} Products
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 md:items-end md:gap-6">
            <p className="flex-1 text-ods-text-primary text-h4">{category.description}</p>

            {/* Arrow Button */}
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-ods-border bg-transparent transition-colors group-hover:bg-ods-accent md:h-12 md:w-12"
              aria-label={`View ${category.name} category`}
            >
              <ChevronRight className="h-5 w-5 text-ods-text-primary transition-colors group-hover:text-ods-text-on-accent md:h-6 md:w-6" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
