import React from 'react'
import { MoreHorizontal, Monitor, ExternalLink } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { OSPlatformId } from '../../utils/os-platforms'
import { OSTypeBadge } from '../features/os-type-badge'
import { InteractiveCard } from './interactive-card'

export interface Device {
  id?: string
  machineId?: string
  name: string
  type?: 'desktop' | 'laptop' | 'mobile' | 'tablet' | 'server'
  operatingSystem?: OSPlatformId | 'macos' | 'ios' | 'android'  // Support both OSPlatformId and legacy values
  organization?: string
  status?: 'active' | 'inactive' | 'offline' | 'warning' | 'error'
  lastSeen?: string | Date
  tags?: string[]
  // Additional device properties
  ipAddress?: string
  macAddress?: string
  version?: string
  location?: string
}

// Action button configuration
export interface ActionButton {
  label: string
  onClick?: () => void
  variant?: 'default' | 'outline' | 'secondary'
  visible?: boolean
}

export interface DeviceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  device: Device
  actions?: {
    moreButton?: {
      visible?: boolean
      onClick?: () => void
    }
    detailsButton?: {
      visible?: boolean
      component?: React.ReactNode
    }
    customActions?: ActionButton[]
  }
  statusBadgeComponent?: React.ReactNode
  onDeviceClick?: (device: Device) => void
}

export function DeviceCard({
  device,
  actions = {
    moreButton: { visible: true }
  },
  statusBadgeComponent,
  onDeviceClick,
  className,
  ...props
}: DeviceCardProps) {

  // Format date for last seen
  const formatLastSeen = (lastSeen?: string | Date) => {
    if (!lastSeen) return null
    
    const date = typeof lastSeen === 'string' ? new Date(lastSeen) : lastSeen
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}/${month}/${day}, ${hours}:${minutes}`
  }

  return (
    <InteractiveCard
      onClick={onDeviceClick ? () => onDeviceClick(device) : undefined}
      className={cn(
        "bg-ods-card relative rounded-[6px] size-full border border-ods-border",
        className
      )}
      {...props}
    >
      {/* Details button - absolutely positioned, vertically centered */}
      {actions.detailsButton?.visible !== false && actions.detailsButton?.component && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
          {actions.detailsButton.component}
        </div>
      )}

      <div className="content-stretch flex flex-col items-start justify-start overflow-clip relative size-full">
        {/* Row 1: Device icon | Device name (clickable with external link) + More button */}
        <div className="bg-ods-card box-border content-stretch flex gap-4 items-center justify-start px-4 py-3 relative shrink-0 w-full">
          {/* Device type icon */}
          <div className="flex items-center justify-center shrink-0">
            <div className="bg-ods-card box-border flex items-center justify-center p-2 rounded-[6px] border border-ods-border h-8 w-8">
              <Monitor className="size-4 text-ods-text-secondary" />
            </div>
          </div>

          {/* Device name - clickable with external link icon */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <h3 className="font-['DM_Sans'] font-medium text-[18px] leading-[24px] text-ods-text-primary truncate transition-colors">
              {device.name}
            </h3>
            {onDeviceClick && (
              <ExternalLink className="size-4 text-ods-text-secondary group-hover:text-ods-accent transition-colors shrink-0" />
            )}
          </div>

          {/* More button */}
          {actions.moreButton?.visible !== false && (
            <div
              className="bg-ods-card box-border flex items-center justify-center p-3 rounded-[6px] shrink-0 border border-ods-border cursor-pointer hover:bg-ods-bg-hover transition-colors"
              onClick={actions.moreButton?.onClick}
            >
              <MoreHorizontal className="size-6 text-ods-text-primary" />
            </div>
          )}
        </div>

        {/* Row 2: OS type | Organization name */}
        <div className="bg-ods-card box-border flex gap-4 items-center px-4 py-2 shrink-0 w-full">
          {/* OS type badge */}
          {device.operatingSystem && (
            <OSTypeBadge
              osType={device.operatingSystem === 'macos' ? 'darwin' : device.operatingSystem}
            />
          )}

          {/* Organization name */}
          {device.organization && (
            <div className="flex-1 min-w-0 font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-ods-text-secondary truncate">
              {device.organization}
            </div>
          )}
        </div>

        {/* Row 3: Custom action buttons (if any) */}
        {actions.customActions && actions.customActions.some(action => action.visible !== false) && (
          <div className="bg-ods-card box-border content-stretch flex gap-2 items-center justify-start px-4 py-2 relative shrink-0 w-full">
            {actions.customActions?.map((action, index) =>
              action.visible !== false && (
                <div
                  key={index}
                  className="bg-ods-card box-border content-stretch flex gap-2 items-center justify-center px-4 py-3 relative rounded-[6px] shrink-0 border border-ods-border cursor-pointer hover:bg-ods-bg-hover transition-colors"
                  onClick={action.onClick}
                >
                  <div className="font-['DM_Sans'] font-bold leading-[0] relative shrink-0 text-[18px] text-ods-text-primary text-nowrap tracking-[-0.36px]">
                    <p className="leading-[24px] whitespace-pre">{action.label}</p>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* Row 4: Status badge | Last seen */}
        <div className="bg-ods-card box-border content-stretch flex gap-4 items-center justify-start px-4 py-2 relative shrink-0 w-full">
          {statusBadgeComponent}
          {device.lastSeen && (
            <div className="flex-1 font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-ods-text-secondary">
              Last Seen: {formatLastSeen(device.lastSeen)}
            </div>
          )}
        </div>

        {/* Tags section */}
        {device.tags && device.tags.length > 0 && (
          <div className="bg-ods-card box-border content-stretch flex gap-2 items-center justify-start p-4 pt-3 relative shrink-0 w-full">
            {device.tags.map((tag, index) => (
              <div
                key={index}
                className="bg-ods-card box-border content-stretch flex gap-2 h-8 items-center justify-center p-2 relative rounded-[6px] shrink-0 border border-ods-border"
              >
                <div className="font-['Azeret_Mono'] font-medium leading-[0] relative shrink-0 text-[14px] text-ods-text-primary text-nowrap tracking-[-0.28px] uppercase">
                  <p className="leading-[20px] whitespace-pre">{tag}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </InteractiveCard>
  )
}