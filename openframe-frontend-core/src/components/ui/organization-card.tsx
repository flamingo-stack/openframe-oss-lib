"use client"

import React from "react"
import Link from "next/link"
import { Monitor } from "lucide-react"
import { cn } from "../../utils/cn"
import { OrganizationIcon } from "../features/organization-icon"

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
        href && "cursor-pointer hover:border-ods-accent [&:hover_h3]:text-ods-accent",
        className
      )}
    >
      {/* Device count (top-right) */}
      {deviceCount !== undefined && (
        <div className="absolute top-4 right-4 flex items-center gap-2 shrink-0">
          <Monitor className="w-4 h-4 text-ods-text-secondary" />
          <span className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-ods-text-secondary">
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

      {/* Header */}
      <div className="flex items-start gap-3 w-full">
        <OrganizationIcon
          imageUrl={fetchedImageUrl || organization.imageUrl}
          organizationName={organization.name}
          size="xl"
          backgroundStyle="dark"
          showBackground={true}
          className="w-[60px] h-[60px]"
        />

        <div className="flex-1 flex flex-col justify-center py-2 min-w-0">
          <h3 className="font-['DM_Sans'] font-bold text-lg leading-[1.33] tracking-[-0.02em] text-ods-text-primary transition-colors truncate">
            {organization.name}
          </h3>
          <p className="font-['DM_Sans'] font-medium text-sm leading-[1.43] text-ods-text-secondary truncate">
            {organization.industry || organization.tier || organization.websiteUrl || "Organization"}
          </p>
        </div>
      </div>

      {/* Description */}
      {organization.description && (
        <div className="w-full h-12 overflow-hidden">
          <p className="font-['DM_Sans'] font-medium text-lg leading-[1.33] text-ods-text-primary line-clamp-2">
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
