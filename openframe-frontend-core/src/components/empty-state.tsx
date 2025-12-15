"use client";

import { Search, FileText, Package } from "lucide-react"
import { Button } from "./ui/button"
import { useRouter } from "next/navigation"

export interface EmptyStateProps {
  type: 'vendors' | 'posts' | 'search' | 'generic'
  title?: string
  description?: string
  showBackButton?: boolean
  onGoBack?: () => void
  backButtonText?: string
  // New CTA properties
  showCTA?: boolean
  ctaText?: string
  onCtaClick?: () => void
  ctaVariant?: 'primary' | 'secondary'
}

export function EmptyState({
  type,
  title,
  description,
  showBackButton = false,
  onGoBack,
  backButtonText = "Go Back",
  showCTA = true,
  ctaText,
  onCtaClick,
  ctaVariant = 'primary'
}: EmptyStateProps) {
  const router = useRouter()

  // Default content based on type
  const getDefaultContent = () => {
    switch (type) {
      case 'vendors':
        return {
          icon: <Package className="w-full h-full" />,
          title: "No vendors found",
          description: "We couldn't find any vendors matching your criteria. Try adjusting your filters or search terms."
        }
      case 'posts':
        return {
          icon: <FileText className="w-full h-full" />,
          title: "No articles found",
          description: "We couldn't find any articles matching your criteria. Try different categories, tags, or search terms."
        }
      case 'search':
        return {
          icon: <Search className="w-full h-full" />,
          title: "No results found",
          description: "Your search didn't return any results. Try different keywords or browse our categories."
        }
      default:
        return {
          icon: <Search className="w-full h-full" />,
          title: "Nothing found",
          description: "We couldn't find what you're looking for. Try adjusting your search or filters."
        }
    }
  }

  // Smart CTA logic based on context
  const getSmartCTA = () => {
    // If custom CTA is provided, use it
    if (ctaText && onCtaClick) {
      return {
        text: ctaText,
        action: onCtaClick
      }
    }

    // Check if we're on the client side
    const isClient = typeof window !== 'undefined'
    const currentPath = isClient ? window.location.pathname : ''

    // Smart defaults based on type and context
    switch (type) {
      case 'search':
        return {
          text: "Reset Filters",
          action: () => {
            if (isClient) {
              // Try to reset search by clearing URL params and refreshing
              const url = new URL(window.location.href)
              url.search = ''
              router.push(url.pathname)
            }
          }
        }
      case 'posts':
        // If we're on blog/community pages, reset blog filters
        if (currentPath.includes('/blog')) {
          return {
            text: "Reset Filters",
            action: () => {
              if (isClient) {
                // Reset blog search and filters by clearing URL params
                const url = new URL(window.location.href)
                url.search = ''
                router.push(url.pathname)
              }
            }
          }
        } else if (currentPath.includes('/profile')) {
          return {
            text: "Browse Vendors",
            action: () => router.push('/vendors')
          }
        }
        return {
          text: "View All Posts",
          action: () => router.push('/blog')
        }
      case 'vendors':
        // If we're in profile or other pages, direct to main content
        if (currentPath.includes('/profile')) {
          return {
            text: "Browse Vendors",
            action: () => router.push('/vendors')
          }
        } else if (currentPath.includes('/vendors') || currentPath.includes('/margin-increase/compare')) {
          return {
            text: "Reset Filters",
            action: () => {
              if (isClient) {
                // Reset vendor search and filters by clearing URL params
                const url = new URL(window.location.href)
                url.search = ''
                router.push(url.pathname)
              }
            }
          }
        }
        return {
          text: "Browse Vendors",
          action: () => router.push('/vendors')
        }
      default:
        return {
          text: "Browse Vendors",
          action: () => router.push('/vendors')
        }
    }
  }

  const defaultContent = getDefaultContent()
  const displayTitle = title || defaultContent.title
  const displayDescription = description || defaultContent.description
  const smartCTA = getSmartCTA()

  return (
    <div className="flex flex-col items-center justify-center py-6 md:py-16 px-6 text-center">
      {/* Icon */}
      <div className="mb-3 md:mb-6 flex items-center justify-center">
        <div className="rounded-full bg-ods-card p-3 md:p-6 border border-ods-border">
          <div className="w-8 h-8 md:w-16 md:h-16 text-ods-text-secondary flex items-center justify-center">
            {defaultContent.icon}
          </div>
        </div>
      </div>

      {/* Title */}
      <h2 className="mb-2 md:mb-3 text-lg md:text-xl font-semibold font-['DM_Sans'] text-ods-text-primary tracking-[-0.02em]">
        {displayTitle}
      </h2>

      {/* Description */}
      <p className="mb-4 md:mb-8 max-w-md text-sm font-medium font-['DM_Sans'] text-ods-text-secondary leading-[1.43em]">
        {displayDescription}
      </p>

      {/* Smart CTA Button */}
      {showCTA && smartCTA && (
        <div className="w-full max-w-xs mb-3">
          <Button
            onClick={smartCTA.action}
            className={ctaVariant === 'primary' 
              ? "w-full bg-[#FFC008] text-black hover:bg-[#FFC008]/90 transition-all duration-150 font-['DM_Sans'] font-medium"
              : "w-full bg-transparent border border-ods-border text-ods-text-primary hover:border-[#FFC008] hover:text-ods-accent transition-all duration-150 font-['DM_Sans'] font-medium"
            }
          >
            {smartCTA.text}
          </Button>
        </div>
      )}

      {/* Optional Back Button */}
      {showBackButton && onGoBack && (
        <div className="w-full max-w-xs">
          <Button
            onClick={onGoBack}
            variant="outline"
            className="w-full transition-all duration-150 font-['DM_Sans'] font-medium"
          >
            {backButtonText}
          </Button>
        </div>
      )}
    </div>
  )
} 