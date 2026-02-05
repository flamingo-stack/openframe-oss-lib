import * as React from 'react'
import { ToolType, ToolTypeValues } from '../types/tool.types'
import { cn } from '../utils/cn'
import { OpenFrameLogo } from './icons'
import { AuthentikLogoIcon } from './icons-v2-generated/brand-logos/authentik-logo-icon'
import { FleetMdmLogoIcon } from './icons-v2-generated/brand-logos/fleet-mdm-logo-icon'
import { MeshcentralLogoIcon } from './icons-v2-generated/brand-logos/meshcentral-logo-icon'
import { TacticalRmmLogoIcon } from './icons-v2-generated/brand-logos/tactical-rmm-logo-icon'
import { OsqueryLogoIcon } from './icons-v2-generated'

type ToolIconConfig = {
  render: (size: number) => React.ReactNode
} | null

const toolIconMap: Record<ToolType, ToolIconConfig> = {
  [ToolTypeValues.FLEET_MDM]: {
    render: (size) => <FleetMdmLogoIcon size={size} />
  },
  [ToolTypeValues.MESHCENTRAL]: {
    render: (size) => <MeshcentralLogoIcon size={size} />
  },
  [ToolTypeValues.TACTICAL_RMM]: {
    render: (size) => <TacticalRmmLogoIcon size={size} />
  },
  [ToolTypeValues.OPENFRAME]: {
    render: () => <OpenFrameLogo className="h-4 w-auto" lowerPathColor="var(--color-accent-primary)" upperPathColor="var(--color-text-primary)" />
  },
  [ToolTypeValues.OPENFRAME_CHAT]: {
    render: () => <OpenFrameLogo className="h-4 w-auto" lowerPathColor="var(--color-accent-primary)" upperPathColor="var(--color-text-primary)" />
  },
  [ToolTypeValues.OPENFRAME_CLIENT]: {
    render: () => <OpenFrameLogo className="h-4 w-auto" lowerPathColor="var(--color-accent-primary)" upperPathColor="var(--color-text-primary)" />
  },
  [ToolTypeValues.AUTHENTIK]: {
    render: (size) => <AuthentikLogoIcon size={size} />
  },
  [ToolTypeValues.OSQUERY]: {
    render: (size) => <OsqueryLogoIcon size={size} />
  },
  [ToolTypeValues.SYSTEM]: null
} as const

export interface ToolIconProps {
  toolType: ToolType
  size?: number
  className?: string
}

export const ToolIcon = React.forwardRef<
  HTMLDivElement,
  ToolIconProps
>(({ toolType, size = 16, className }, ref) => {
  const iconConfig = toolIconMap[toolType]
  const icon = iconConfig?.render(size) ?? null

  return (
    <div
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center shrink-0 text-[#888888]',
        className
      )}
      style={{ width: size, height: size, color: '#888888' }}
      aria-label={`${toolType} icon`}
    >
      {icon}
    </div>
  )
})

ToolIcon.displayName = 'ToolIcon'