"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { Monitor } from "lucide-react"
import { cn } from "../../utils/cn"
import { OrganizationIcon } from "../features/organization-icon"
import { InteractiveCard } from "./interactive-card"

export interface Organization {
  id: string
  organizationId?: string
  name: string
  imageUrl?: string | null
  industry?: string
  tier?: string
  websiteUrl?: string
  description?: string
  // Stats for footer (optional)
  totalDevices?: number
  activeDevices?: number
  mrrUsd?: number
  // Custom metadata
  [key: string]: any
}

export interface OrganizationCardProps {
  /**
   * Organization data
   */
  organization: Organization

  /**
   * Pre-fetched image URL (from useBatchImages)
   * If not provided, OrganizationIcon will fetch automatically
   */
  fetchedImageUrl?: string

  /**
   * Additional CSS classes
   */
  className?: string

  /**
   * Custom hover accent color (defaults to ods-accent)
   */
  hoverAccentColor?: string

  /**
   * Show action button in top-right
   */
  showActionButton?: boolean

  /**
   * Action button configuration
   */
  actionButton?: {
    icon: React.ReactNode
    label: string
    onClick: (org: Organization, e: React.MouseEvent) => void
    variant?: 'ghost' | 'primary'
    disabled?: boolean
  }

  /**
   * Custom click handler (default: navigate to /organizations/details/{id})
   */
  onClick?: (org: Organization) => void

  /**
   * Base URL for navigation (default: current domain)
   */
  baseUrl?: string

  /**
   * Footer stats to display (optional)
   */
  footerStats?: Array<{
    icon?: React.ReactNode
    value: string | number
    label?: string
  }>

  /**
   * Custom footer component (replaces default stats)
   */
  customFooter?: React.ReactNode

  /**
   * Device count to display in top-right corner
   * If not provided, top-right area will be hidden
   */
  deviceCount?: number
}

/**
 * OrganizationCard - Reusable card component for displaying organizations
 *
 * Matches VendorCard styling and behavior exactly from OpenMSP for 100% visual parity.
 *
 * Features:
 * - **VendorCard-style hover:** Border and title change to accent color
 * - **OrganizationIcon integration:** 60x60px logo with fallback initials
 * - **Fixed height description:** 48px (h-12) with line-clamp-2
 * - **Footer stats:** Flexible stats display (devices, MRR, etc.)
 * - **Action buttons:** Optional top-right button (remove, add, etc.)
 * - **Responsive:** Works on mobile, tablet, desktop
 *
 * Usage Examples:
 *
 * ```typescript
 * // Basic usage with pre-fetched image
 * const fetchedImages = useBatchImages(imageUrls)
 * <OrganizationCard
 *   organization={org}
 *   fetchedImageUrl={fetchedImages[org.imageUrl]}
 * />
 *
 * // With custom footer stats
 * <OrganizationCard
 *   organization={org}
 *   footerStats={[
 *     { value: org.totalDevices, label: 'devices' },
 *     { value: `$${org.mrrUsd}`, label: 'MRR' }
 *   ]}
 * />
 *
 * // With action button
 * <OrganizationCard
 *   organization={org}
 *   showActionButton
 *   actionButton={{
 *     icon: <Trash2 className="h-4 w-4" />,
 *     label: 'Remove',
 *     onClick: (org) => handleRemove(org.id)
 *   }}
 * />
 * ```
 */
export function OrganizationCard({
  organization,
  fetchedImageUrl,
  className,
  hoverAccentColor,
  showActionButton = false,
  actionButton,
  onClick,
  baseUrl = "",
  footerStats,
  customFooter,
  deviceCount
}: OrganizationCardProps) {
  const router = useRouter()

  const handleActionClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    actionButton?.onClick(organization, e)
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Only handle card click if not clicking on buttons
    if ((e.target as HTMLElement).closest('button')) {
      return
    }

    if (onClick) {
      onClick(organization)
    } else {
      // Default navigation
      const orgUrl = baseUrl
        ? `${baseUrl}/organizations/details/${organization.id}`
        : `/organizations/details/${organization.id}`

      if (baseUrl) {
        window.open(orgUrl, '_blank')
      } else {
        router.push(orgUrl)
      }
    }
  }

  return (
    <InteractiveCard
      onClick={handleCardClick}
      hoverAccentColor={hoverAccentColor}
      className={cn(
        "flex flex-col bg-ods-card border border-ods-border rounded-lg p-4 gap-3 w-full relative",
        className
      )}
    >
      {/* Device count with icon (top-right corner) - Only show if provided */}
      {deviceCount !== undefined && (
        <div className="absolute top-4 right-4 flex items-center gap-2 shrink-0">
          <Monitor className="w-4 h-4 text-ods-text-secondary" />
          <span className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-ods-text-secondary">
            {deviceCount.toLocaleString()} devices
          </span>
        </div>
      )}

      {/* Action button (top-right corner) - Only if no device count */}
      {!deviceCount && showActionButton && actionButton && (
        <button
          className={cn(
            "absolute top-2 right-2 h-8 w-8 rounded flex items-center justify-center z-10 transition-colors",
            actionButton.variant === 'primary'
              ? "bg-ods-accent text-black hover:bg-ods-accent-hover"
              : "text-ods-text-secondary hover:text-red-500 hover:bg-red-100/10"
          )}
          onClick={handleActionClick}
          disabled={actionButton.disabled}
          aria-label={actionButton.label}
        >
          {actionButton.icon}
        </button>
      )}

      {/* Header Section - Row layout matching VendorCard */}
      <div className="flex items-start gap-3 w-full">
        {/* Organization Logo - 60px fixed, matching VendorIcon xl size */}
        <OrganizationIcon
          imageUrl={fetchedImageUrl || organization.imageUrl}
          organizationName={organization.name}
          size="xl"
          backgroundStyle="dark"
          showBackground={true}
          preFetched={!!fetchedImageUrl}
          className="w-[60px] h-[60px]"
        />

        {/* Text Container - Column, center justify, 8px vertical padding */}
        <div className="flex-1 flex flex-col justify-center py-2 min-w-0">
          {/* Title - DM Sans 700, 18px, 1.33 line height, matching VendorCard */}
          <h3 className={cn(
            "font-['DM_Sans'] font-bold text-lg leading-[1.33] tracking-[-0.02em] text-ods-text-primary transition-colors truncate",
            !hoverAccentColor && 'group-hover:text-ods-accent'
          )}>
            {organization.name}
          </h3>
          {/* Subtitle - Industry or Tier, DM Sans 500, 14px */}
          <p className="font-['DM_Sans'] font-medium text-sm leading-[1.43] text-ods-text-secondary truncate">
            {organization.industry || organization.tier || organization.websiteUrl || "Organization"}
          </p>
        </div>
      </div>

      {/* Description Section - Fixed 48px height matching VendorCard */}
      {organization.description && (
        <div className="w-full h-12 overflow-hidden">
          <p className="font-['DM_Sans'] font-medium text-lg leading-[1.33] text-ods-text-primary line-clamp-2">
            {organization.description}
          </p>
        </div>
      )}

      {/* Footer Section - Custom or default stats */}
      {customFooter ? (
        customFooter
      ) : footerStats && footerStats.length > 0 ? (
        <div className="flex items-center justify-between gap-2 w-full min-w-0">
          {/* Stats display */}
          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-shrink">
            {footerStats.map((stat, index) => (
              <div key={index} className="flex items-center gap-1 flex-shrink-0">
                {stat.icon}
                <span className="font-['DM_Sans'] font-medium text-base text-ods-text-primary">
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </span>
                {stat.label && (
                  <span className="font-['DM_Sans'] font-medium text-sm text-ods-text-secondary">
                    {stat.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </InteractiveCard>
  )
}
