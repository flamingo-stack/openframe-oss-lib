import * as React from 'react'
import { ToolType, ToolTypeValues } from '../types/tool.types'
import { cn } from '../utils/cn'
import { OpenFrameLogo } from './icons'
import { AuthentikLogoIcon } from './icons-v2-generated/brand-logos/authentik-logo-icon'
import { FleetMdmLogoIcon } from './icons-v2-generated/brand-logos/fleet-mdm-logo-icon'
import { MeshcentralLogoIcon } from './icons-v2-generated/brand-logos/meshcentral-logo-icon'
import { TacticalRmmLogoIcon } from './icons-v2-generated/brand-logos/tactical-rmm-logo-icon'
export interface ToolIconProps {
  toolType: ToolType
  size?: number
  className?: string
}

export const ToolIcon = React.forwardRef<
  HTMLDivElement,
  ToolIconProps
>(({ toolType, size = 16, className }, ref) => {
  const renderIcon = () => {
    switch (toolType) {
      case ToolTypeValues.FLEET_MDM:
        return <FleetMdmLogoIcon size={size} />
      case ToolTypeValues.MESHCENTRAL:
        return <MeshcentralLogoIcon size={size} />
      case ToolTypeValues.TACTICAL_RMM:
        return <TacticalRmmLogoIcon size={size} />
      case ToolTypeValues.OPENFRAME:
      case ToolTypeValues.OPENFRAME_CHAT:
      case ToolTypeValues.OPENFRAME_CLIENT:
        return <OpenFrameLogo className="h-4 w-auto" lowerPathColor="var(--color-accent-primary)" upperPathColor="var(--color-text-primary)" />
      case ToolTypeValues.AUTHENTIK:
        return <AuthentikLogoIcon size={size} />
      case ToolTypeValues.SYSTEM:
      default:
        return null
    }
  }

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
      {renderIcon()}
    </div>
  )
})

ToolIcon.displayName = 'ToolIcon'