/**
 * Centralized OS Types
 *
 * Single source of truth for all operating system type information across the platform.
 * Handles normalization of OS values from various sources (Fleet MDM, Tactical RMM, GraphQL).
 */

import { AppleLogoIcon } from '../components/icons-v2-generated/brand-logos/apple-logo-icon'
import { LinuxLogoIcon } from '../components/icons-v2-generated/brand-logos/linux-logo-icon'
import { WindowsLogoIcon } from '../components/icons-v2-generated/brand-logos/windows-logo-icon'
import React from 'react'
import type { OSPlatformId } from '../utils/os-platforms'

export const OSTypeValues = {
  WINDOWS: 'WINDOWS',
  MACOS: 'MACOS',
  LINUX: 'LINUX'
} as const

export type OSType = (typeof OSTypeValues)[keyof typeof OSTypeValues]

/**
 * OS type definition with all metadata
 */
export interface OSTypeDefinition {
  id: OSType
  label: string
  value: string
  icon: React.ComponentType<any>
  platformId: OSPlatformId
  aliases: string[]  // Alternative names/values that map to this OS
}

/**
 * Complete list of all OS types with icons and labels
 * SINGLE SOURCE OF TRUTH - Use this everywhere
 */
export const OS_TYPES: OSTypeDefinition[] = [
  {
    id: OSTypeValues.MACOS,
    label: 'macOS',
    value: OSTypeValues.MACOS,
    icon: AppleLogoIcon,
    platformId: 'darwin',
    aliases: ['darwin', 'macos', 'mac os', 'osx', 'os x', 'mac']  // Put more specific ones first, 'mac' last to avoid false matches
  },
  {
    id: OSTypeValues.WINDOWS,
    label: 'Windows',
    value: OSTypeValues.WINDOWS,
    icon: WindowsLogoIcon,
    platformId: 'windows',
    aliases: ['windows', 'win32', 'win64', 'win']  // 'win' last since it's shortest
  },
  {
    id: OSTypeValues.LINUX,
    label: 'Linux',
    value: OSTypeValues.LINUX,
    icon: LinuxLogoIcon,
    platformId: 'linux',
    aliases: ['linux', 'ubuntu', 'debian', 'centos', 'redhat', 'fedora', 'pop', 'pop!_os', 'arch', 'manjaro']
  }
]

/**
 * Maps OS types to display labels
 */
export const osLabels: Record<OSType, string> = {
  [OSTypeValues.WINDOWS]: 'Windows',
  [OSTypeValues.MACOS]: 'macOS',
  [OSTypeValues.LINUX]: 'Linux'
}
