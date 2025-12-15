'use client'

import React from 'react'
import { OSTypeBadge } from './os-type-badge'
import { StatusBadge } from '../ui/status-badge'
import { cn } from '../../utils/cn'
import { OS_TYPES } from '../../types/os.types'
import type { OSPlatformId } from '../../utils/os-platforms'

export interface PlatformSelectorOption {
  /** Platform ID (windows, darwin, linux) */
  platformId: OSPlatformId
  /** Whether this option is disabled */
  disabled?: boolean
  /** Optional badge to show (e.g., "Coming Soon") */
  badge?: {
    text: string
    colorScheme?: 'cyan' | 'green' | 'yellow' | 'purple' | 'pink' | 'success' | 'error' | 'warning' | 'default'
  }
}

export interface OSPlatformSelectorProps {
  /** Currently selected platform */
  value: OSPlatformId
  /** Callback when platform selection changes */
  onValueChange: (platform: OSPlatformId) => void
  /** Label displayed above the selector */
  label?: string
  /** Custom platform options (defaults to all OS_TYPES) */
  options?: PlatformSelectorOption[]
  /** Disabled platforms (simple array alternative to custom options) */
  disabledPlatforms?: OSPlatformId[]
  /** Additional CSS classes for the container */
  className?: string
  /** Icon size for the OS badges */
  iconSize?: string
}

/**
 * OSPlatformSelector - Unified component for selecting operating system platform
 *
 * Features:
 * - Tab-style selector with OS icons
 * - Supports disabled states with badges
 * - Selected state with accent color
 * - Consistent ODS styling
 *
 * Usage Example:
 * ```tsx
 * import { OSPlatformSelector } from '@flamingo/ui-kit/components/features'
 *
 * const [platform, setPlatform] = useState<OSPlatformId>('darwin')
 *
 * <OSPlatformSelector
 *   value={platform}
 *   onValueChange={setPlatform}
 *   label="Select Platform"
 *   disabledPlatforms={['linux']}
 * />
 *
 * // Or with custom options for badges:
 * <OSPlatformSelector
 *   value={platform}
 *   onValueChange={setPlatform}
 *   label="Select Platform"
 *   options={[
 *     { platformId: 'windows' },
 *     { platformId: 'darwin' },
 *     { platformId: 'linux', disabled: true, badge: { text: 'Coming Soon', colorScheme: 'cyan' } }
 *   ]}
 * />
 * ```
 */
export function OSPlatformSelector({
  value,
  onValueChange,
  label,
  options,
  disabledPlatforms = [],
  className,
  iconSize = 'w-5 h-5'
}: OSPlatformSelectorProps) {
  // Build options from OS_TYPES if not provided
  const platformOptions: PlatformSelectorOption[] = options || OS_TYPES.map(os => ({
    platformId: os.platformId,
    disabled: disabledPlatforms.includes(os.platformId)
  }))

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <div className="text-ods-text-primary text-[18px] font-medium">
          {label}
        </div>
      )}
      <div className="flex w-full bg-ods-bg border border-ods-border rounded-[6px] p-1 gap-1">
        {platformOptions.map((option) => {
          const osType = OS_TYPES.find(os => os.platformId === option.platformId)
          if (!osType) return null

          const selected = value === option.platformId
          const isDisabled = option.disabled

          const badgeElement = option.badge ? (
            <StatusBadge
              text={option.badge.text}
              variant="button"
              colorScheme={option.badge.colorScheme || 'cyan'}
            />
          ) : undefined

          return (
            <div
              key={osType.id}
              onClick={() => !isDisabled && onValueChange(option.platformId)}
              className="flex-1 relative"
            >
              <OSTypeBadge
                osType={osType.value}
                iconSize={iconSize}
                iconColor={selected ? 'black' : undefined}
                rigntIcon={badgeElement}
                variant="ghost"
                alignment="center"
                className={cn(
                  '!w-full sm:!w-full min-h-[52px] items-center justify-center rounded-[4px] p-2 text-[14px] md:text-[18px] font-medium transition-colors pointer-events-auto',
                  isDisabled
                    ? 'bg-transparent text-ods-text-secondary opacity-50 cursor-not-allowed'
                    : selected
                      ? 'bg-ods-accent text-ods-text-on-accent hover:bg-ods-accent-hover cursor-pointer'
                      : 'bg-transparent text-ods-text-primary hover:bg-ods-bg-hover cursor-pointer'
                )}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
