import { CheckCircleIcon as LucideCheckCircleIcon, XCircleIcon } from './ui/custom-icons'

interface YesNoDisplayProps {
  value: boolean
  yesText?: string
  noText?: string
  customText?: string  // For displaying custom text instead of Yes/No
  className?: string
}

export function YesNoDisplay({ 
  value, 
  yesText = "Yes", 
  noText = "No", 
  customText,
  className = "" 
}: YesNoDisplayProps) {
  // If custom text is provided, display it with appropriate icon
  if (customText) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <LucideCheckCircleIcon className="h-6 w-6" />
        <span className="text-ods-text-primary text-[16px]">{customText}</span>
      </div>
    )
  }
  
  // Standard Yes/No display
  if (value) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <LucideCheckCircleIcon className="h-6 w-6" />
        <span className="text-ods-text-primary text-[16px]">{yesText}</span>
      </div>
    )
  }
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <XCircleIcon className="h-6 w-6" />
      <span className="text-ods-text-secondary text-[16px]">{noText}</span>
    </div>
  )
}

/**
 * Unified logic to determine if a feature value should be considered "Yes" or "No"
 */
export function evaluateFeatureValue(
  value: string | null | undefined,
  dataType: 'boolean' | 'text' | 'number'
): boolean {
  // Handle truly empty/null values
  if (value === null || value === undefined || value === '') {
    return false
  }
  
  const stringValue = String(value).toLowerCase().trim()
  
  // Handle explicit null/empty string values
  if (stringValue === 'null' || stringValue === 'n/a' || stringValue === 'none' || stringValue === '-') {
    return false
  }
  
  // Boolean data type
  if (dataType === 'boolean') {
    return stringValue === 'true' || 
           stringValue === '1' || 
           stringValue === 'yes' || 
           stringValue === '✓' || 
           stringValue === '✅'
  }
  
  // Text data type
  if (dataType === 'text') {
    // Handle emoji values
    if (stringValue === '✅' || stringValue === '✓') {
      return true
    }
    if (stringValue === '❌' || stringValue === '✗') {
      return false
    }
    
    // Handle explicit no values
    if (stringValue === 'no' || stringValue === 'false' || stringValue === '0') {
      return false
    }
    
    // Any other non-empty text is considered "yes"
    return stringValue.length > 0
  }
  
  // Number data type
  if (dataType === 'number') {
    const numValue = parseFloat(stringValue)
    return !isNaN(numValue) && numValue > 0
  }
  
  // Default fallback
  return false
} 