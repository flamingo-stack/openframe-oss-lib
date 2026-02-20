/**
 * ScriptInfoSection Component
 *
 * Displays script information in a card with header (title, description)
 * and detail cells (shell type, supported platforms, category, author).
 * Responsive layout: stacks cells on mobile, shows grid on desktop.
 */

import React from 'react'
import { cn } from '../../utils/cn'
import { getOSLabel } from '../../utils/os-utils'
import { getShellLabel } from '../../utils/shell-utils'

/**
 * Props for author avatar display
 */
export interface ScriptAuthor {
  /** Author name */
  name: string
  /** Author initials (used when no photo) */
  initials?: string
  /** URL to author's photo */
  photoUrl?: string
}

/**
 * Props for ScriptInfoSection component
 */
export interface ScriptInfoSectionProps {
  /** Script title/name */
  headline: string
  /** Script description */
  subheadline?: string
  /** Shell type (POWERSHELL, BASH, CMD, etc.) */
  shellType?: string
  /** Array of supported platform strings (windows, darwin, linux, etc.) */
  supportedPlatforms?: string[]
  /** Script category */
  category: string
  /** Author information */
  author?: ScriptAuthor
  /** Additional CSS classes */
  className?: string
}

/**
 * Formats supported platforms array into a display string
 * @param platforms - Array of platform strings (e.g., ['windows', 'darwin', 'linux'])
 * @returns Formatted string (e.g., 'Windows, macOS, Linux')
 */
function formatSupportedPlatforms(platforms?: string[]): string {
  if (!platforms || platforms.length === 0) {
    return 'All Platforms'
  }
  return platforms.map((platform) => getOSLabel(platform)).join(', ')
}

/**
 * Gets initials from a name
 * @param name - Full name
 * @returns Two-letter initials
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

/**
 * InfoCell - Single info cell with label and value
 */
interface InfoCellProps {
  label: string
  value: string
  avatar?: ScriptAuthor
  className?: string
}

function InfoCell({ label, value, avatar, className }: InfoCellProps) {
  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      {/* Avatar for author cell */}
      {avatar && (
        <div className="relative shrink-0 size-8 rounded-full bg-ods-bg border border-ods-border overflow-hidden">
          {avatar.photoUrl ? (
            <img
              src={avatar.photoUrl}
              alt={avatar.name}
              className="size-full object-cover"
            />
          ) : (
            <div className="size-full flex items-center justify-center text-ods-text-secondary text-sm font-medium">
              {avatar.initials || getInitials(avatar.name)}
            </div>
          )}
        </div>
      )}

      {/* Text content */}
      <div className="flex flex-col min-w-0">
        <span className="text-ods-text-primary font-['DM_Sans'] text-[14px] leading-[20px] md:text-[18px] md:leading-[24px] font-medium truncate">
          {value}
        </span>
        <span className="text-ods-text-secondary font-['DM_Sans'] text-[12px] leading-[16px] md:text-[14px] md:leading-[20px] font-medium truncate">
          {label}
        </span>
      </div>
    </div>
  )
}

/**
 * ScriptInfoSection - Displays script information in a structured card
 *
 * @example
 * ```tsx
 * <ScriptInfoSection
 *   title="System Backup Script"
 *   description="Comprehensive Linux system backup script..."
 *   shellType="BASH"
 *   supportedPlatforms={['linux']}
 *   category="System Maintenance"
 *   author={{ name: 'John Doe', photoUrl: '/avatars/john.jpg' }}
 * />
 * ```
 */
export const ScriptInfoSection: React.FC<ScriptInfoSectionProps> = ({
  headline,
  subheadline,
  shellType,
  supportedPlatforms,
  category,
  author,
  className
}) => {
  const shellLabel = getShellLabel(shellType)
  const platformsLabel = formatSupportedPlatforms(supportedPlatforms)

  return (
    <div
      className={cn(
        'bg-ods-card border border-ods-border rounded-[6px] overflow-hidden',
        className
      )}
    >
      {/* Header row with title and description */}
      <div className="p-4 border-b border-ods-border">
        <div className="flex flex-col gap-1">
          <h3 className="text-ods-text-primary font-['DM_Sans'] text-[14px] leading-[20px] md:text-[18px] md:leading-[24px] font-medium">
            {headline}
          </h3>
          {subheadline && (
            <p className="text-ods-text-secondary font-['DM_Sans'] text-[12px] leading-[16px] md:text-[14px] md:leading-[20px] font-medium break-words">
              {subheadline}
            </p>
          )}
        </div>
      </div>

      {/* Details section with info cells
          - Mobile/Tablet (<lg): 2x2 grid with divider between rows
          - Desktop (lg+): 4 columns in single row
      */}
      {/* First row: Shell Type, Supported Platforms */}
      <div className="px-4 py-4 grid grid-cols-2 gap-4 lg:grid-cols-4 border-b border-ods-border lg:border-b-0">
        <InfoCell label="Shell Type" value={shellLabel} />
        <InfoCell label="Supported Platforms" value={platformsLabel} />
        {/* Desktop only: Category and Author in same row */}
        <InfoCell label="Category" value={category} className="hidden lg:flex" />
        {author && (
          <InfoCell
            label="Added by"
            value={author.name}
            avatar={author}
            className="hidden lg:flex"
          />
        )}
      </div>
      {/* Second row (mobile/tablet only): Category, Author */}
      <div className="px-4 py-4 grid grid-cols-2 gap-4 lg:hidden">
        <InfoCell label="Category" value={category} />
        {author && (
          <InfoCell label="Added by" value={author.name} avatar={author} />
        )}
      </div>
    </div>
  )
}

ScriptInfoSection.displayName = 'ScriptInfoSection'
