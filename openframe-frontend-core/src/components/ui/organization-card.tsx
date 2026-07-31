"use client"

import React from "react"
import Link from "../../embed-shims/next-link"
import { Monitor } from "lucide-react"
import { cn } from "../../utils/cn"
import { EntityImage } from "./entity-image"

export interface Organization {
  id: string
  organizationId?: string
  name: string
  imageUrl?: string | null
  industry?: string
  tier?: string
  websiteUrl?: string
  description?: string
  totalDevices?: number
  activeDevices?: number
  mrrUsd?: number
  [key: string]: any
}

export interface OrganizationCardProps {
  organization: Organization
  fetchedImageUrl?: string
  className?: string
  href?: string
  showActionButton?: boolean
  actionButton?: {
    icon: React.ReactNode
    label: string
    onClick: (org: Organization, e: React.MouseEvent) => void
    variant?: 'ghost' | 'primary'
    disabled?: boolean
  }
  footerStats?: Array<{
    icon?: React.ReactNode
    value: string | number
    label?: string
  }>
  customFooter?: React.ReactNode
  deviceCount?: number
}

export function OrganizationCard({
  organization,
  fetchedImageUrl,
  className,
  href,
  showActionButton = false,
  actionButton,
  footerStats,
  customFooter,
  deviceCount
}: OrganizationCardProps) {
  const handleActionClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    actionButton?.onClick(organization, e)
  }

  const card = (
    <div
      className={cn(
        "flex flex-col bg-ods-card rounded-[6px] border border-ods-border overflow-clip p-4 gap-3 w-full relative",
        "transition-colors",
        href && "cursor-pointer hover:border-ods-border-hover hover:bg-ods-card-hover",
        className
      )}
    >
      {/* Device count (top-right) */}
      {deviceCount !== undefined && (
        <div className="absolute top-4 right-4 flex items-center gap-2 shrink-0">
          <Monitor className="w-4 h-4 text-ods-text-secondary" />
          <span className="text-h6 text-ods-text-secondary">
            {deviceCount.toLocaleString()} devices
          </span>
        </div>
      )}

      {/* Action button (top-right) - only if no device count */}
      {!deviceCount && showActionButton && actionButton && (
        <button
          className={cn(
            "absolute top-2 right-2 h-8 w-8 rounded flex items-center justify-center z-10 transition-colors",
            actionButton.variant === 'primary'
              ? "bg-ods-accent text-ods-text-on-accent hover:bg-ods-accent-hover"
              : "text-ods-text-secondary hover:text-ods-error hover:bg-ods-error-secondary"
          )}
          onClick={handleActionClick}
          disabled={actionButton.disabled}
          aria-label={actionButton.label}
        >
          {actionButton.icon}
        </button>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 w-full">
        <EntityImage
          src={fetchedImageUrl || organization.imageUrl}
          alt={organization.name}
        />

        <div className="flex-1 flex flex-col justify-center py-2 min-w-0">
          <h3 className="text-h3 text-ods-text-primary transition-colors truncate" title={organization.name}>
            {organization.name}
          </h3>
          <p className="text-h6 text-ods-text-secondary truncate" title={organization.industry || organization.tier || organization.websiteUrl || "Organization"}>
            {organization.industry || organization.tier || organization.websiteUrl || "Organization"}
          </p>
        </div>
      </div>

      {/* Description */}
      {organization.description && (
        <div className="w-full h-12 overflow-hidden">
          <p className="text-h4 text-ods-text-primary line-clamp-2" title={organization.description}>
            {organization.description}
          </p>
        </div>
      )}

      {/* Footer */}
      {customFooter ? (
        customFooter
      ) : footerStats && footerStats.length > 0 ? (
        <div className="flex items-center justify-between gap-2 w-full min-w-0">
          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-shrink">
            {footerStats.map((stat, index) => (
              <div key={index} className="flex items-center gap-1 flex-shrink-0">
                {stat.icon}
                <span className="text-h6 text-ods-text-primary">
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </span>
                {stat.label && (
                  <span className="text-h6 text-ods-text-secondary">
                    {stat.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block no-underline text-inherit">
        {card}
      </Link>
    )
  }

  return card
}
