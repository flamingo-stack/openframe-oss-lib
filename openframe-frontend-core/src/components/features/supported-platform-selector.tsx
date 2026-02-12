'use client'

import { OS_TYPES } from '../../types/os.types'
import { cn } from '../../utils/cn'
import type { OSPlatformId } from '../../utils/os-platforms'
import { CheckCircleIcon } from '../icons-v2-generated/signs-and-symbols/check-circle-icon'

export interface SupportedPlatformSelectorProps {
  /** Currently selected platform IDs */
  value: OSPlatformId[]
  /** Callback when platform selection changes */
  onValueChange: (platforms: OSPlatformId[]) => void
  /** Label displayed above the selector */
  label?: string
  /** Disabled platform IDs (cannot be toggled) */
  disabledPlatforms?: OSPlatformId[]
  /** Additional CSS classes for the container */
  className?: string
}

/**
 * SupportedPlatformSelector — Multi-select platform toggle buttons
 *
 * Renders OS platform buttons that can be toggled independently.
 * Selected platforms show a tinted accent background with a check circle icon.
 *
 * Responsive:
 * - Mobile: h-12, gap-3, text-[14px]
 * - Tablet+: h-16, gap-4, text-[18px]
 *
 * @example
 * ```tsx
 * const [platforms, setPlatforms] = useState<OSPlatformId[]>(['windows', 'linux'])
 *
 * <SupportedPlatformSelector
 *   value={platforms}
 *   onValueChange={setPlatforms}
 *   label="Supported Platform"
 * />
 * ```
 */
export function SupportedPlatformSelector({
  value,
  onValueChange,
  label,
  disabledPlatforms = [],
  className,
}: SupportedPlatformSelectorProps) {
  function togglePlatform(platformId: OSPlatformId) {
    if (disabledPlatforms.includes(platformId)) return

    if (value.includes(platformId)) {
      onValueChange(value.filter((id) => id !== platformId))
    } else {
      onValueChange([...value, platformId])
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <span className="text-ods-text-primary text-[14px] md:text-[18px] font-medium">
          {label}
        </span>
      )}
      <div className="flex gap-3 md:gap-4">
        {OS_TYPES.map((osType) => {
          const selected = value.includes(osType.platformId)
          const isDisabled = disabledPlatforms.includes(osType.platformId)
          const IconComponent = osType.icon

          return (
            <button
              key={osType.id}
              type="button"
              onClick={() => togglePlatform(osType.platformId)}
              disabled={isDisabled}
              className={cn(
                'flex flex-1 items-center gap-2 rounded-[6px] border transition-colors duration-200',
                'h-12 px-3 py-2 md:h-16 md:px-4 md:py-3',
                'font-medium text-[14px] md:text-[18px] leading-6 select-none',
                'text-ods-text-primary',
                selected
                  ? 'border-ods-accent'
                  : 'bg-[#212121] border-[#3a3a3a]',
                !isDisabled && !selected && 'hover:border-ods-accent/30 cursor-pointer',
                !isDisabled && selected && 'cursor-pointer',
                isDisabled && 'opacity-50 cursor-not-allowed',
              )}
              style={selected ? {
                backgroundColor: 'color-mix(in srgb, var(--color-accent-primary) 45%, #212121)',
              } : undefined}
            >
              <IconComponent className="shrink-0 w-6 h-6" color={selected ? 'var(--color-accent-primary)' : 'var(--color-text-primary)'} />
              <span className="flex-1 text-left truncate">{osType.label}</span>
              {selected && (
                <CheckCircleIcon
                  className="shrink-0 w-5 h-5 md:w-6 md:h-6"
                  color="var(--color-accent-primary)"
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

SupportedPlatformSelector.displayName = 'SupportedPlatformSelector'
