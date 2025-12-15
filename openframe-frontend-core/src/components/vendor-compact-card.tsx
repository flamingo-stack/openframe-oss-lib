import React from 'react';
import { VendorIcon } from './vendor-icon';
import { ChevronButton } from './chevron-button';
import { XButton } from './x-button';
import { PricingDisplay, PRICING_STYLES } from './pricing-display';
import { EmptyVendorIcon } from './empty-vendor-icon';
import { cn } from "../utils/cn";
import { VendorWithMedia } from '../utils/vendor-media-stub';
import { getStructuredPricingSummary, type ComparisonPricing } from '../utils/compare-utils-stub';
import { OpenmspLogo } from './openmsp-logo';

interface VendorCompactCardProps {
  vendor: VendorWithMedia & {
    id?: number;
    title: string;
    slug?: string;
    logo?: string | null;
    vendor_classification?: Array<{
      classification: 'open_source' | 'commercial' | 'openframe_selected';
    }>;
    vendor_pricing?: Array<{
      id?: number;
      vendor_id?: number;
      model?: string | null;
      price?: number | null;
      unit?: string | null;
      tier?: string | null;
      billing_cycle?: string | null;
      setup_cost?: number | null;
      notes?: string | null;
    }>;
  };
  score?: {
    score: number;
    total: number;
  };
  isExpanded?: boolean;
  showChevron?: boolean;
  chevronSize?: 'icon' | 'default';
  chevronBackgroundColor?: string;
  chevronBorderColor?: string;
  onChevronClick?: (e: React.MouseEvent) => void;
  onXClick?: (e: React.MouseEvent) => void;
  className?: string;
  contentClassName?: string;
  chevronClassName?: string;
  xButtonClassName?: string;
  showPricing?: boolean;
  onLearnMore?: () => void;
  onViewPricing?: () => void;
  featureSummary?: string;
  comparisonContext?: boolean;
  isEmptyState?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  isEditableText?: boolean;
  editableValue?: string;
  onEditableChange?: (value: string) => void;
  onEditableKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onEditableFocus?: () => void;
  /** Optional element rendered on the far right (before chevron/x) */
  rightAddon?: React.ReactNode;
  /** Optional element rendered to the right side – top row when stacked layout active */
  stackedInfoTop?: React.ReactNode;
  /** Optional element rendered to the right side – bottom row when stacked layout active */
  stackedInfoBottom?: React.ReactNode;
  /** Optional subtitle text rendered below the vendor name (e.g., sub-category) */
  subtitle?: string;
  /** When true (and no custom onClick supplied) clicking the card opens the vendor page in a new tab */
  linkToVendor?: boolean;
  /** deprecated: removed badge rendering inside card */
  selectionSource?: never;
  showSelectionSource?: never;
}

export function VendorCompactCard({
  vendor,
  score,
  isExpanded = false,
  showChevron = true,
  chevronSize = 'default',
  chevronBackgroundColor,
  chevronBorderColor,
  onChevronClick,
  onXClick,
  className,
  contentClassName,
  chevronClassName,
  xButtonClassName,
  showPricing = false,
  onLearnMore,
  onViewPricing,
  featureSummary,
  comparisonContext = false,
  isEmptyState = false,
  onClick,
  isEditableText = false,
  editableValue = "",
  onEditableChange,
  onEditableKeyDown,
  onEditableFocus,
  rightAddon,
  stackedInfoTop,
  stackedInfoBottom,
  subtitle,
  linkToVendor = false,
}: VendorCompactCardProps) {
  // Default click behavior: open vendor detail in new tab when no custom handler supplied
  const defaultOnClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (onClick) {
        onClick(e);
        return;
      }
      if (linkToVendor && vendor?.slug) {
        // Prevent triggering parent row click (e.g., in tables)
        e.stopPropagation();
        const url = `/vendor/${vendor.slug}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
    [onClick, linkToVendor, vendor?.slug]
  );

  return (
    <div 
      className={cn(
        "flex items-center justify-between relative",
        (onClick || (linkToVendor && vendor?.slug)) && "cursor-pointer",
        className
      )}
      onClick={defaultOnClick}
    >
      {/* Left: Vendor Icon, Name, and Score */}
      <div className={cn(
        "flex items-center gap-3 min-w-0 flex-1",
        contentClassName
      )}>
        {isEmptyState ? (
          // Empty state icon with same containerization as VendorIcon
          <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#161616] border border-ods-border">
            <OpenmspLogo className="w-6 h-6" innerFrontBubbleColor="#0f0f0f" backBubbleColor="#888888" frontBubbleColor="#888888" />
          </div>
        ) : (
          <VendorIcon 
            vendor={vendor}
            size="lg"
            backgroundStyle="dark"
          />
        )}
        <div className="flex flex-col min-w-0">
          {isEditableText ? (
            <input
              type="text"
              value={editableValue}
              onChange={(e) => onEditableChange?.(e.target.value)}
              onKeyDown={onEditableKeyDown}
              onFocus={onEditableFocus}
              className={cn(
                "font-['DM_Sans'] text-[18px] font-medium leading-tight bg-transparent border-none outline-none w-full",
                isEmptyState ? "text-ods-text-secondary placeholder-[#888888]" : "text-ods-text-primary placeholder-[#888888]"
              )}
              placeholder={vendor.title}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
          ) : (
            <h3
              className={cn(
                "font-['DM_Sans'] text-[18px] md:text-[18px] font-medium leading-tight truncate whitespace-nowrap max-w-[120px] sm:max-w-[140px] md:max-w-[160px] lg:max-w-[180px] xl:max-w-[220px]",
                isEmptyState ? "text-ods-text-secondary" : "text-ods-text-primary"
              )}
              title={vendor.title}
            >
              {vendor.title}
            </h3>
          )}
          {subtitle && (
            <span className="hidden md:block font-['DM_Sans'] text-[16px] text-ods-text-secondary leading-tight truncate">
              {subtitle}
            </span>
          )}
          {score && !comparisonContext && (
            <span className="font-['DM_Sans'] text-[14px] font-medium text-ods-text-secondary leading-tight">
              {score.score}/{score.total}
            </span>
          )}
          {showPricing && (
            <div className="leading-tight">
              {vendor.vendor_classification?.some(c => c.classification === 'open_source') ? (
                // Open Source - Show feature summary in comparison context, otherwise "Learn More"
                comparisonContext && featureSummary ? (
                  <span className="font-['DM_Sans'] text-[12px] text-ods-text-secondary font-medium">
                    {featureSummary}
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLearnMore?.();
                    }}
                    className="font-['DM_Sans'] text-[12px] text-ods-text-secondary hover:text-ods-accent font-medium transition-colors duration-200 cursor-pointer text-left"
                  >
                    Learn More
                  </button>
                )
              ) : (
                // Commercial - Show feature summary in comparison context, otherwise pricing
                comparisonContext && featureSummary ? (
                  <span className="font-['DM_Sans'] text-[12px] text-ods-text-secondary font-medium">
                    {featureSummary}
                  </span>
                ) : (
                  // Show pricing for commercial vendors outside comparison context
                  <div className="font-['DM_Sans'] font-medium">
                    {vendor.vendor_pricing && vendor.vendor_pricing.length > 0 ? (
                      (() => {
                        // Convert vendor_pricing to ComparisonPricing format
                        const comparisonPricing: ComparisonPricing[] = vendor.vendor_pricing.map(p => ({
                          id: p.id || 0,
                          vendor_id: p.vendor_id || vendor.id || 0,
                          model: p.model,
                          price: p.price,
                          unit: p.unit,
                          tier: p.tier,
                          billing_cycle: p.billing_cycle,
                          setup_cost: p.setup_cost,
                          notes: p.notes
                        }));
                        
                        // Use EXACT same function and component as comparison table
                        const structuredPricing = getStructuredPricingSummary(comparisonPricing);
                        
                        return (
                          <PricingDisplay 
                            pricing={structuredPricing} 
                            styleConfig={PRICING_STYLES.compact}
                          />
                        );
                      })()
                    ) : (
                      <PricingDisplay 
                        pricing={[]} 
                        styleConfig={PRICING_STYLES.compact}
                      />
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right section: badge, optional addon, then X/Chevron buttons */}
      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        {/* Stacked info (pricing + badge) */}
        {(stackedInfoTop || stackedInfoBottom) && (
          <div className="flex flex-col items-end gap-1 mr-2">
            {stackedInfoTop}
            {stackedInfoBottom}
          </div>
        )}
        {rightAddon}
        {/* X Button - only show when expanded */}
        {isExpanded && onXClick && (
          <XButton
            size={chevronSize}
            onClick={onXClick}
            className={cn("flex-shrink-0", xButtonClassName)}
            backgroundColor={chevronBackgroundColor}
            borderColor={chevronBorderColor}
          />
        )}
        {/* Chevron Button */}
        {showChevron && (
          <ChevronButton
            size={chevronSize}
            isExpanded={isExpanded}
            onClick={onChevronClick}
            className={cn("flex-shrink-0", chevronClassName)}
            backgroundColor={chevronBackgroundColor}
            borderColor={chevronBorderColor}
          />
        )}
      </div>
    </div>
  );
} 