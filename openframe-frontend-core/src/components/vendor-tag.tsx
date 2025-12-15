import { OpenSourceIcon, CoinsIcon } from "./icons-stub"
import { OpenFrameLogo } from "./openframe-logo"
import { cn } from "../utils/cn"
import { Hand, Sparkles } from "lucide-react"

export interface VendorTagProps {
  type: 'open-source' | 'commercial' | 'free' | 'freemium' | 'paid' | 'enterprise' | 'recommended' | 'classification' | 'ai' | 'manual' | 'openframe_selected' | 'placeholder'
  text?: string
  className?: string
  size?: 'sm' | 'md'
  hidden?: boolean
  accentColor?: string
}

export function VendorTag({
  type,
  text,
  className = "",
  hidden = false,
  size = 'md',
  accentColor
}: VendorTagProps) {
  // Base classes for the tag container
  const baseClasses = cn(
    "flex items-center gap-1.5 bg-[#161616] border border-ods-border rounded whitespace-nowrap",
    size === 'sm' ? "px-2 py-1" : "px-2.5 py-1.5"
  )


  // Get display text and styling based on type
  const getTagContent = () => {
    switch (type) {
      case 'placeholder':
        return {
          text: "Placeholder",
          textColor: "text-ods-text-primary",
          icon: (
            <div className="w-4 h-4  rounded-sm flex items-center justify-center flex-shrink-0">
              <Sparkles width={10} height={10} className="text-ods-text-primary" />
            </div>
          )
        }
      case 'ai':
        return {
          text: "AI Selected",
          textColor: "text-ods-text-primary",
          icon: (
            <div className="w-4 h-4  rounded-sm flex items-center justify-center flex-shrink-0">
              <Sparkles width={10} height={10} className="text-ods-text-primary" />
            </div>
          )
        }
      case 'manual':
        return {
          text: "Manually Selected",
          textColor: "text-ods-text-secondary",
          icon: (
            <div className="w-4 h-4  rounded-sm flex items-center justify-center flex-shrink-0">
              <Hand width={10} height={10} className="text-ods-text-secondary" />
            </div>
          )
        }
      case 'open-source':
        return {
          text: text || "Open Source",
          icon: (
            <div 
              className="w-4 h-4 bg-ods-accent rounded-sm flex items-center justify-center flex-shrink-0"
              style={accentColor ? { backgroundColor: accentColor } : undefined}
            >
              <OpenSourceIcon width={10} height={10} className="text-[#1A1A1A]" />
            </div>
          )
        }
      case 'commercial':
        return {
          text: text || "Commercial Vendor",
          icon: (
            <div className="w-4 h-4 bg-ods-border rounded-sm flex items-center justify-center flex-shrink-0">
              <CoinsIcon width={10} height={10} className="text-ods-text-secondary" />
            </div>
          )
        }
      case 'free':
        return {
          text: text || "Free",
          icon: (
            <div className="w-4 h-4 bg-ods-accent rounded-sm flex items-center justify-center flex-shrink-0">
              <span className="text-[#1A1A1A] text-[8px] font-bold">$</span>
            </div>
          )
        }
      case 'freemium':
        return {
          text: text || "Freemium",
          icon: (
            <div className="w-4 h-4 bg-ods-accent rounded-sm flex items-center justify-center flex-shrink-0">
              <span className="text-[#1A1A1A] text-[8px] font-bold">$</span>
            </div>
          )
        }
      case 'paid':
        return {
          text: text || "Paid",
          icon: (
            <div className="w-4 h-4 bg-ods-border rounded-sm flex items-center justify-center flex-shrink-0">
              <CoinsIcon width={10} height={10} className="text-ods-text-secondary" />
            </div>
          )
        }
      case 'enterprise':
        return {
          text: text || "Enterprise",
          icon: (
            <div className="w-4 h-4 bg-ods-accent rounded-sm flex items-center justify-center flex-shrink-0">
              <span className="text-[#1A1A1A] text-[8px] font-bold">E</span>
            </div>
          )
        }
      case 'recommended':
        return {
          text: text || "Recommended",
          icon: (
            <div className="w-4 h-4 bg-ods-accent rounded-sm flex items-center justify-center flex-shrink-0">
              <span className="text-[#1A1A1A] text-[8px] font-bold">★</span>
            </div>
          )
        }
      case 'classification':
        // Handle specific classification types based on the text value
        const classificationType = text?.toLowerCase()

        if (classificationType === 'open_source') {
          return {
            text: "Open Source",
            icon: (
              <div className="w-4 h-4 bg-ods-accent rounded-sm flex items-center justify-center flex-shrink-0">
                <OpenSourceIcon width={10} height={10} className="text-[#1A1A1A]" />
              </div>
            )
          }
        } else if (classificationType === 'commercial') {
          return {
            text: "Commercial Vendor",
            icon: (
              <div className="w-4 h-4 bg-ods-border rounded-sm flex items-center justify-center flex-shrink-0">
                <CoinsIcon width={10} height={10} className="text-ods-text-secondary" />
              </div>
            )
          }
        } else if (classificationType === 'openframe_selected') {
          return {
            text: "OpenFrame Selected",
            icon: <OpenFrameLogo lowerPathColor="currentColor" upperPathColor="currentColor" className="h-4 w-4 text-ods-accent" />
          }
        } else {
          // Fallback for unknown classification types
          return {
            text: text || "Classification",
            icon: (
              <div className="w-4 h-4 bg-ods-accent rounded-sm flex items-center justify-center flex-shrink-0">
                <span className="text-[#1A1A1A] text-[8px] font-bold">C</span>
              </div>
            )
          }
        }
      case 'openframe_selected':
        return {
          text: text || "OpenFrame Selected",
          icon: <OpenFrameLogo lowerPathColor="currentColor" upperPathColor="currentColor" className="h-4 w-4 text-ods-accent" />
        }
      default:
        return {
          text: text || type,
          icon: null
        }
    }
  }

  const { text: displayText, icon, textColor } = getTagContent()

  return (
    <div className={cn(baseClasses, className, hidden && "invisible")}>
      {icon}
      <span className={cn(
        "font-['Azeret_Mono'] font-semibold uppercase",
        textColor ? textColor : "text-ods-text-primary",
        size === 'sm' ? "text-[10px]" : "text-xs"
      )}>
        {displayText}
      </span>
    </div>
  )
} 