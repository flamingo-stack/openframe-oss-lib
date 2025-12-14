import { StructuredPricingSummary as StructuredPricingItem } from '../utils/compare-utils-stub'

// Using StructuredPricingItem from compare-utils instead of local interface

interface PricingStyleConfig {
  priceTextSize: string
  priceTextColor: string
  secondaryTextSize: string
  secondaryTextColor: string
  showTildePrefix: boolean
  fontFamily?: string
}

interface PricingDisplayProps {
  pricing: StructuredPricingItem[] | string | StructuredPricingItem // Support both new structure and legacy string
  className?: string
  styleConfig?: PricingStyleConfig
}

// Default style configurations for different contexts
export const PRICING_STYLES = {
  // Comparison table style (current default)
  comparison: {
    priceTextSize: 'text-[16px]',
    priceTextColor: 'text-ods-text-primary',
    secondaryTextSize: 'text-[16px]',
    secondaryTextColor: 'text-ods-text-secondary',
    showTildePrefix: false,
    fontFamily: "font-['DM_Sans']"
  },
  // Vendor dropdown compact style (Figma design)
  compact: {
    priceTextSize: 'text-[12px]',
    priceTextColor: 'text-ods-text-secondary',
    secondaryTextSize: 'text-[12px]',
    secondaryTextColor: 'text-ods-text-secondary',
    showTildePrefix: true,
    fontFamily: "font-['DM_Sans']"
  },
  // Card style for vendor cards
  card: {
    priceTextSize: 'text-[14px]',
    priceTextColor: 'text-ods-text-primary',
    secondaryTextSize: 'text-[14px]',
    secondaryTextColor: 'text-ods-text-secondary',
    showTildePrefix: true,
    fontFamily: "font-['DM_Sans']"
  }
} as const

/**
 * Shared component for consistent pricing display with configurable styling
 * Now accepts structured pricing data and style configuration for better control
 */
export function PricingDisplay({ 
  pricing, 
  className = "", 
  styleConfig = PRICING_STYLES.comparison 
}: PricingDisplayProps) {
  // Legacy support for string input
  if (typeof pricing === 'string') {
    return <LegacyPricingDisplay pricing={pricing} className={className} styleConfig={styleConfig} />
  }
  
  // Convert to array if single item
  const pricingArray = Array.isArray(pricing) ? pricing : [pricing];
  
  // Handle empty pricing
  if (!pricingArray || pricingArray.length === 0) {
    return (
      <span className={`${styleConfig.priceTextColor} ${styleConfig.priceTextSize} ${styleConfig.fontFamily} ${className}`}>
        No pricing data
      </span>
    )
  }
  
  // Handle single pricing item
  if (pricingArray.length === 1) {
    const item = pricingArray[0]
    const price = item.ranges?.[0]?.min || 0;
    const unit = item.ranges?.[0]?.unit;
    return (
      <span className={`${styleConfig.fontFamily} ${className}`}>
        <span className={`${styleConfig.priceTextColor} ${styleConfig.priceTextSize}`}>
          {formatPriceValue(price, styleConfig.showTildePrefix)}
        </span>
        {unit && (
          <span className={`${styleConfig.secondaryTextColor} ${styleConfig.secondaryTextSize}`}>
            /{unit}
          </span>
        )}
      </span>
    )
  }
  
  // Handle multiple pricing items
  const priceValues = pricingArray.map(item => formatPriceValue(item.ranges?.[0]?.min || 0, styleConfig.showTildePrefix))
  
  // Find the first item that has unit info
  const itemWithUnit = pricingArray.find(item => item.ranges?.[0]?.unit)
  
  return (
    <span className={`${styleConfig.fontFamily} ${className}`}>
      <span className={`${styleConfig.priceTextColor} ${styleConfig.priceTextSize}`}>
        {priceValues.join(' | ')}
      </span>
      {itemWithUnit && itemWithUnit.ranges?.[0]?.unit && (
        <span className={`${styleConfig.secondaryTextColor} ${styleConfig.secondaryTextSize}`}>
          /{itemWithUnit.ranges[0].unit}
        </span>
      )}
    </span>
  )
}

/**
 * Format price value consistently with configurable tilde prefix
 */
function formatPriceValue(price: number | 'Free' | 'Contact', showTildePrefix: boolean = false): string {
  if (price === 'Free' || price === 'Contact') {
    return price
  }
  if (price === 0) {
    return 'Free'
  }
  return showTildePrefix ? `~$${price}` : `$${price}`
}

/**
 * Legacy component for backward compatibility with string input
 */
function LegacyPricingDisplay({ 
  pricing, 
  className = "", 
  styleConfig = PRICING_STYLES.comparison 
}: { 
  pricing: string; 
  className?: string; 
  styleConfig?: PricingStyleConfig 
}) {
  // Handle "Free" case
  if (pricing === 'Free' || pricing === 'No pricing data') {
    return (
      <span className={`${styleConfig.priceTextColor} ${styleConfig.priceTextSize} ${styleConfig.fontFamily} ${className}`}>
        {pricing}
      </span>
    )
  }
  
  // Parse pricing string to separate main price from unit/cycle info
  const parsePricing = (pricingStr: string) => {
    // Handle comma-separated format like "$10/device/month, $120/device/year"
    if (pricingStr.includes(', ')) {
      // Split by comma and parse each part separately
      const parts = pricingStr.split(', ')
      const parsedParts = parts.map(part => {
        const match = part.trim().match(/^(\$\d+(?:-\$\d+)?|\d+(?:-\d+)?|Free)(.*)$/)
        if (match) {
          const price = match[1].startsWith('$') ? match[1] : `$${match[1]}`
          return {
            price,
            suffix: match[2]
          }
        }
        return { price: part.trim(), suffix: '' }
      })
      
      // Reconstruct with proper styling
      return {
        mainValue: parsedParts.map(p => p.price).join(', '),
        secondaryInfo: parsedParts.length > 0 && parsedParts[0].suffix ? parsedParts[0].suffix : ''
      }
    }
    
    // Handle pipe-separated format like "$529/site/year | Free"
    if (pricingStr.includes(' | ')) {
      const parts = pricingStr.split(' | ')
      const prices = parts.map(part => {
        const match = part.trim().match(/^(\$\d+(?:-\$\d+)?|\d+(?:-\d+)?|Free)(.*)$/)
        return match ? match[1] : part.trim()
      })
      
      return {
        mainValue: prices.join(' | '),
        secondaryInfo: ''
      }
    }
    
    // Handle multi-cycle format like "$10/$120/device/month/year"
    if (pricingStr.includes('/$')) {
      // Find all price patterns
      const pricePattern = /\$\d+(?:-\$\d+)?/g
      const matches = [...pricingStr.matchAll(pricePattern)]
      
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1]
        const lastPriceEnd = lastMatch.index! + lastMatch[0].length
        
        const mainValue = pricingStr.substring(0, lastPriceEnd)
        const secondaryInfo = pricingStr.substring(lastPriceEnd)
        
        return { mainValue, secondaryInfo }
      }
    }
    
    // Handle single price format like "$529/site/year" or "$0-$529/site/year"
    const singlePriceMatch = pricingStr.match(/^(\$\d+(?:-\$\d+)?|Free)(.*)$/)
    if (singlePriceMatch) {
      return {
        mainValue: singlePriceMatch[1],
        secondaryInfo: singlePriceMatch[2]
      }
    }
    
    // Fallback - treat entire string as main value
    return {
      mainValue: pricingStr,
      secondaryInfo: ''
    }
  }
  
  const { mainValue, secondaryInfo } = parsePricing(pricing)
  
  return (
    <span className={`${styleConfig.fontFamily} ${className}`}>
      <span className={`${styleConfig.priceTextColor} ${styleConfig.priceTextSize}`}>{mainValue}</span>
      {secondaryInfo && (
        <span className={`${styleConfig.secondaryTextColor} ${styleConfig.secondaryTextSize}`}>{secondaryInfo}</span>
      )}
    </span>
  )
}

/**
 * Utility function to format pricing for display in the PricingDisplay component
 * This can be used to pre-process pricing strings if needed
 */
export function formatPricingForDisplay(pricing: string): string {
  return pricing
} 