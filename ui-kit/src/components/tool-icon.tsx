import * as React from 'react'
import { cn } from '../utils/cn'
import { ToolIconProps } from '../types/logs.types'
import { FleetIcon } from './icons/fleet-icon'
import { MeshCentralIcon } from './icons/meshcentral-icon'
import { TacticalIcon } from './icons/tactical-icon'
import { OpenFrameLogo } from './icons'

export const ToolIcon = React.forwardRef<
  HTMLDivElement,
  ToolIconProps
>(({ toolType, size = 16, className }, ref) => {
  const renderIcon = () => {
    const normalizedType = toolType?.toUpperCase()

    switch (normalizedType) {
      case 'FLEET':
      case 'FLEET_MDM':
      case 'FLEET-MDM':
        return <FleetIcon size={size} />
      case 'MESHCENTRAL':
      case 'MESH':
        return <MeshCentralIcon size={size} />
      case 'TACTICAL':
      case 'TACTICAL_RMM':
      case 'TACTICAL-RMM':
        return <TacticalIcon size={size} />
      case 'OPENFRAME_CHAT':
        return <OpenFrameLogo className="h-4 w-auto" lowerPathColor="var(--color-accent-primary)" upperPathColor="var(--color-text-primary)" />
      case 'OPENFRAME_CLIENT':
        return <OpenFrameLogo className="h-4 w-auto" lowerPathColor="var(--color-accent-primary)" upperPathColor="var(--color-text-primary)" />
      default:
        return <></>
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