import React from 'react'

import { DevicesIcon } from '../devices-icon'
import { DesktopIcon } from './desktop-icon'
import { LaptopIcon } from './laptop-icon'
import { ServerIcon } from './server-icon'

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
        <DesktopIcon
          className={props?.className}
          style={{ color: props?.color }}
          width={props?.size}
          height={props?.size}
        />
      )
    case 'laptop':
      return (
        <LaptopIcon
          className={props?.className}
          style={{ color: props?.color }}
          width={props?.size}
          height={props?.size}
        />
      )
    case 'server':
      return (
        <ServerIcon
          className={props?.className}
          style={{ color: props?.color }}
          width={props?.size}
          height={props?.size}
        />
      )
    case 'mobile':
    case 'tablet':
    default:
      return (
        <DevicesIcon
          className={props?.className}
          style={{ color: props?.color }}
          width={props?.size}
          height={props?.size}
        />
      )
  }
}
