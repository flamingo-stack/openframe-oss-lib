import React from 'react'

import { HardDriveIcon } from '@/components/icons-v2-generated/devices/hard-drive-icon'
import { LaptopIcon } from '@/components/icons-v2-generated/devices/laptop-icon'
import { MonitorIcon } from '@/components/icons-v2-generated/devices/monitor-icon'

export type DeviceType = 'desktop' | 'laptop' | 'mobile' | 'tablet' | 'server'

export interface DeviceTypeIconProps {
  className?: string
  color?: string
  size?: number
}

export function getDeviceTypeIcon(
  type?: DeviceType,
  props?: DeviceTypeIconProps
): React.ReactElement {
  switch (type) {
    case 'desktop':
      return (
        <MonitorIcon
          className={props?.className}
          style={{ color: props?.color }}
          size={props?.size}
        />
      )
    case 'laptop':
      return (
        <LaptopIcon
          className={props?.className}
          style={{ color: props?.color }}
          size={props?.size}
        />
      )
    case 'server':
      return (
        <HardDriveIcon
          className={props?.className}
          style={{ color: props?.color }}
          size={props?.size}
        />
      )
    case 'mobile':
    case 'tablet':
    default:
      return (
        <MonitorIcon
          className={props?.className}
          style={{ color: props?.color }}
          size={props?.size}
        />
      )
  }
}
