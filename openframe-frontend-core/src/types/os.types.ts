/**
 * Centralized OS Types
 *
 * Single source of truth for all operating system type information across the platform.
 * Handles normalization of OS values from various sources (Fleet MDM, Tactical RMM, GraphQL).
 */

import React from 'react'
import {
  WindowsIcon,
  MacOSIcon,
  LinuxIcon
} from '../components/icons'
import type { OSPlatformId } from '../utils/os-platforms'

export type OSType =
  | 'WINDOWS'
  | 'MACOS'
  | 'LINUX'

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
    id: 'MACOS',
    label: 'macOS',
    value: 'MACOS',
    icon: MacOSIcon,
    platformId: 'darwin',
    aliases: ['darwin', 'macos', 'mac os', 'osx', 'os x', 'mac']  // Put more specific ones first, 'mac' last to avoid false matches
  },
  {
    id: 'WINDOWS',
    label: 'Windows',
    value: 'WINDOWS',
    icon: WindowsIcon,
    platformId: 'windows',
    aliases: ['windows', 'win32', 'win64', 'win']  // 'win' last since it's shortest
  },
  {
    id: 'LINUX',
    label: 'Linux',
    value: 'LINUX',
    icon: LinuxIcon,
    platformId: 'linux',
    aliases: ['linux', 'ubuntu', 'debian', 'centos', 'redhat', 'fedora', 'pop', 'pop!_os', 'arch', 'manjaro']
  }
]

/**
 * Maps OS types to display labels
 */
export const osLabels: Record<OSType, string> = {
  WINDOWS: 'Windows',
  MACOS: 'macOS',
  LINUX: 'Linux'
}

/**
 * Normalize OS type string to standard OSType enum
 * Handles case-insensitive matching and various OS name variations
 *
 * @param osType - Raw OS type string from API or device data
 * @returns Normalized OSType or undefined if not recognized
 *
 * @example
 * normalizeOSType('windows') // 'WINDOWS'
 * normalizeOSType('Darwin') // 'MACOS'
 * normalizeOSType('Ubuntu') // 'LINUX'
 */
export function normalizeOSType(osType?: string): OSType | undefined {
  if (!osType) return undefined

  const normalized = osType.toLowerCase().trim()

  // Check for exact matches first, then partial matches
  // This prevents "win" from matching "darwin"
  for (const osTypeDef of OS_TYPES) {
    // Check for exact word match first
    if (osTypeDef.aliases.some(alias => {
      // Exact match
      if (normalized === alias) return true
      // Word boundary match (e.g., "mac" in "mac os" but not in "vmac")
      const wordBoundaryRegex = new RegExp(`\\b${alias}\\b`, 'i')
      return wordBoundaryRegex.test(osType)
    })) {
      return osTypeDef.id
    }
  }

  // Fallback to partial matching for version strings like "macOS 26.0.1"
  for (const osTypeDef of OS_TYPES) {
    if (osTypeDef.aliases.some(alias => normalized.includes(alias))) {
      return osTypeDef.id
    }
  }

  return undefined
}

/**
 * Get display label for an OS type
 *
 * @param osType - OS type string (can be raw or normalized)
 * @returns Display label
 */
export function getOSLabel(osType?: string): string {
  if (!osType) return 'Unknown'

  const normalized = normalizeOSType(osType)
  return normalized ? osLabels[normalized] : osType
}

/**
 * Get icon component for an OS type
 *
 * @param osType - OS type string (can be raw or normalized)
 * @returns Icon component or undefined
 */
export function getOSIcon(osType?: string): React.ComponentType<any> | undefined {
  if (!osType) return undefined

  const normalized = normalizeOSType(osType)
  if (!normalized) return undefined

  const osTypeDef = OS_TYPES.find(t => t.id === normalized)
  return osTypeDef?.icon
}

/**
 * Get OS type definition by OS type string
 *
 * @param osType - OS type string (can be raw or normalized)
 * @returns Complete OS type definition or undefined
 */
export function getOSTypeDefinition(osType?: string): OSTypeDefinition | undefined {
  if (!osType) return undefined

  const normalized = normalizeOSType(osType)
  if (!normalized) return undefined

  return OS_TYPES.find(t => t.id === normalized)
}

/**
 * Get platform ID for an OS type (for cross-referencing with OS_PLATFORMS)
 *
 * @param osType - OS type string (can be raw or normalized)
 * @returns Platform ID or undefined
 */
export function getOSPlatformId(osType?: string): OSPlatformId | undefined {
  const osTypeDef = getOSTypeDefinition(osType)
  return osTypeDef?.platformId
}

/**
 * Check if device OS matches a specific platform
 *
 * @param deviceOS - Device OS string
 * @param targetPlatform - Target platform to check against
 * @returns True if OS matches platform
 *
 * @example
 * isOSPlatform('Darwin', 'darwin') // true
 * isOSPlatform('Windows 10', 'windows') // true
 * isOSPlatform('Ubuntu', 'linux') // true
 */
export function isOSPlatform(deviceOS?: string, targetPlatform?: OSPlatformId): boolean {
  if (!deviceOS || !targetPlatform) return false

  const platformId = getOSPlatformId(deviceOS)
  return platformId === targetPlatform
}
