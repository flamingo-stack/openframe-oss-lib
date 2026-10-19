'use client';

import { ChevronRight } from 'lucide-react';
import Link from '../embed-shims/next-link';
import { ICON_SIZE } from '../styles/component-sizes';
import type { RealCategoryCardProps } from '../types/category';
import { cn } from '../utils/cn';
import { TextLineSkeleton } from './loading/unified-skeleton';
import { useLoadingScope } from './ui/loading-scope';
import { VendorIcon, VendorIconSkeleton } from './vendor-icon';

/** The card's layout, read by the card and by its skeleton, so the skeleton is the card's size. */
const CARD_SHELL_CLASS = 'group relative block rounded-lg border border-ods-border bg-ods-card p-3 pb-4 md:p-4 md:pb-6';
const CARD_STACK_CLASS = 'flex flex-col gap-4 md:gap-6';
const ICON_STRIP_CLASS = 'relative h-8 w-full overflow-hidden md:h-10';
const ICON_ROW_CLASS = 'flex w-full gap-2 md:gap-3';
/** The strip's vendor icons: one size and frame for the loaded icon and its skeleton. */
const VENDOR_ICON_SIZE = 'md';
const VENDOR_ICON_CLASS = 'overflow-hidden rounded opacity-60 grayscale filter';
/** The inner stacks only stack: a one-column grid, not another column flexbox (WEBVIEW-001). */
const INFO_STACK_CLASS = 'grid grid-cols-1 gap-2';
const TITLE_STACK_CLASS = 'grid grid-cols-1 gap-1';
const FOOT_ROW_CLASS = 'flex items-start justify-between gap-4 md:items-end md:gap-6';
const ARROW_BOX_CLASS =
  'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-ods-border bg-transparent transition-colors md:h-12 md:w-12';
const ARROW_ICON_CLASS = `${ICON_SIZE.step} text-ods-text-primary transition-colors`;
/** As many icon boxes as the widest strip shows (the strip clips the rest). */
const ICON_STRIP_FOLD = 20;

/** The strip's fades at both ends, into the card's own surface. */
function StripFades() {
  return (
    <>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-ods-card to-transparent md:w-6" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-ods-card to-transparent md:w-6" />
    </>
  );
}

// Component that receives vendor and subcategory data as props
export function CategoriesCart({
  category,
  vendors = [],
  vendorCount = 0,
  subcategoryCount = 0,
  isLoading = false,
  className = '',
}: RealCategoryCardProps) {
  if (useLoadingScope() || isLoading) return <CategoriesCartSkeleton className={className} />;
  return (
    <Link
      href={`/vendors?category=${category.slug}`}
      className={cn(CARD_SHELL_CLASS, 'transition-colors hover:border-ods-accent', className)}
    >
      <div className={CARD_STACK_CLASS}>
        {/* Vendor Icons Grid */}
        <div className={ICON_STRIP_CLASS}>
          <div className={ICON_ROW_CLASS}>
            {/* A category with no vendors leaves the strip empty: it keeps its height, and draws no stand-in icons. */}
            {vendors.map(vendor => (
              <VendorIcon key={vendor.id} vendor={vendor} size={VENDOR_ICON_SIZE} className={VENDOR_ICON_CLASS} />
            ))}
          </div>
          <StripFades />
        </div>

        {/* Category Information - Updated to use real data */}
        <div className={INFO_STACK_CLASS}>
          <div className={TITLE_STACK_CLASS}>
            <h3 className="text-ods-text-primary transition-colors text-h3 group-hover:text-ods-accent">
              {category.name}
            </h3>
            <p className="text-ods-text-secondary text-h6">
              {subcategoryCount || 0} Subcategories • {vendorCount || 0} Products
            </p>
          </div>

          <div className={FOOT_ROW_CLASS}>
            <p className="flex-1 text-ods-text-primary text-h4">{category.description}</p>

            {/* Arrow Button */}
            <div
              className={cn(ARROW_BOX_CLASS, 'group-hover:bg-ods-accent')}
              aria-label={`View ${category.name} category`}
            >
              <ChevronRight className={cn(ARROW_ICON_CLASS, 'group-hover:text-ods-text-on-accent')} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * A category card while its category is read: the card's frame, the vendor strip as icon boxes, a bar for the name,
 * the counts line and two description lines, and the arrow box as it is. Not a link: there is no category yet.
 */
export function CategoriesCartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(CARD_SHELL_CLASS, className)} aria-hidden>
      <div className={CARD_STACK_CLASS}>
        <div className={ICON_STRIP_CLASS}>
          <div className={ICON_ROW_CLASS}>
            {Array.from({ length: ICON_STRIP_FOLD }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton icons never reorder
              <VendorIconSkeleton key={index} size={VENDOR_ICON_SIZE} className="rounded" />
            ))}
          </div>
          <StripFades />
        </div>
        <div className={INFO_STACK_CLASS}>
          <div className={TITLE_STACK_CLASS}>
            <TextLineSkeleton type="h3" className="w-40" />
            <TextLineSkeleton type="h6" className="w-48" />
          </div>
          <div className={FOOT_ROW_CLASS}>
            <TextLineSkeleton type="h4" lines={2} className="flex-1" />
            <div className={ARROW_BOX_CLASS}>
              <ChevronRight className={ARROW_ICON_CLASS} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
