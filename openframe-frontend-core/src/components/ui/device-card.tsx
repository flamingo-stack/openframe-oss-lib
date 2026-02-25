"use client"

import { MonitorIcon } from '../icons-v2-generated/devices/monitor-icon'
import { Ellipsis01Icon } from '../icons-v2-generated/interface'
import React from 'react'
import { cn } from '../../utils/cn'
import type { OSPlatformId } from '../../utils/os-platforms'
import { OSTypeIcon } from '../features/os-type-badge'
import { Tag, type TagProps } from './tag'

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
  statusTag?: TagProps
  onDeviceClick?: (device: Device) => void
}

export function DeviceCard({
  device,
  actions = {
    moreButton: { visible: true }
  },
  statusTag,
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
    <div
      onClick={onDeviceClick ? () => onDeviceClick(device) : undefined}
      className={cn(
        "bg-ods-card rounded-[6px] border border-ods-border overflow-clip",
        "flex flex-col gap-4 p-4",
        onDeviceClick && "cursor-pointer",
        className
      )}
      {...props}
    >
      {/* Row 1: Device icon | OS icon + Name + Organization | More button | Details button | Custom actions */}
      <div className="flex gap-4 items-center w-full">
        {/* Device type icon */}
        <div className="flex items-center justify-center p-2 rounded-[6px] border border-ods-border shrink-0">
          <MonitorIcon className="text-ods-text-secondary" size={16} />
        </div>

        {/* OS icon + Device name + Organization (stacked) */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex gap-1 items-center">
            {device.operatingSystem && (
              <OSTypeIcon
                osType={device.operatingSystem === 'macos' ? 'darwin' : device.operatingSystem}
                size="w-4 h-4"
                className="shrink-0"
              />
            )}
            <span className="font-['DM_Sans'] font-medium text-[18px] leading-[24px] text-ods-text-primary truncate">
              {device.name}
            </span>
          </div>
          {device.organization && (
            <span className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-ods-text-secondary truncate">
              {device.organization}
            </span>
          )}
        </div>

        {/* More button */}
        {actions.moreButton?.visible !== false && (
          <div
            className="flex items-center justify-center p-3 rounded-[6px] shrink-0 border border-ods-border cursor-pointer hover:bg-ods-bg-hover transition-colors"
            onClick={(e) => { e.stopPropagation(); actions.moreButton?.onClick?.() }}
          >
            <Ellipsis01Icon className="text-ods-text-primary" />
          </div>
        )}

        {/* Details button */}
        {actions.detailsButton?.visible !== false && actions.detailsButton?.component && (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {actions.detailsButton.component}
          </div>
        )}

        {/* Custom action buttons */}
        {actions.customActions?.map((action, index) =>
          action.visible !== false && (
            <div
              key={index}
              className="flex items-center justify-center px-4 py-3 rounded-[6px] shrink-0 border border-ods-border cursor-pointer hover:bg-ods-bg-hover transition-colors"
              onClick={(e) => { e.stopPropagation(); action.onClick?.() }}
            >
              <span className="font-['DM_Sans'] font-bold text-[18px] leading-[24px] text-ods-text-primary text-nowrap tracking-[-0.36px]">
                {action.label}
              </span>
            </div>
          )
        )}
      </div>

      {/* Row 2: Status badge | Last seen */}
      {(statusTag || device.lastSeen) && 
        <div className="flex gap-2 items-center w-full">
          {statusTag && (
            <Tag
              variant={statusTag.variant}
              icon={statusTag.icon}
              onClose={statusTag.onClose}
              className={statusTag.className}
              label={statusTag.label}
            />
          )}
          {device.lastSeen && (
            <span className="flex-1 font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-ods-text-secondary truncate">
              Last Seen: {formatLastSeen(device.lastSeen)}
            </span>
          )}
        </div>
      }

      {/* Tags section */}
      {device.tags && device.tags.length > 0 && (
        <div className="flex gap-2 items-center w-full flex-wrap">
          {device.tags.map((tag, index) => (
            <Tag key={index} variant="outline" label={tag} />
          ))}
        </div>
      )}
    </div>
  )
}