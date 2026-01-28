/**
 * Tool Utilities
 *
 * Provides normalization and conversion utilities for tool types.
 * Handles various input formats (aliases, case variations) and converts
 * them to the canonical ToolType used throughout the platform.
 */

import { ToolType, toolLabels } from '../types/tool.types'

/**
 * Map of common tool name variants to canonical ToolType
 */
const toolAliasMap: Record<string, ToolType> = {
  // Tactical RMM
  'TACTICAL': 'TACTICAL_RMM',
  'TACTICAL_RMM': 'TACTICAL_RMM',
  'TACTICAL-RMM': 'TACTICAL_RMM',
  'TACTICALRMM': 'TACTICAL_RMM',
  'tactical': 'TACTICAL_RMM',
  'tactical_rmm': 'TACTICAL_RMM',
  'tactical-rmm': 'TACTICAL_RMM',
  'tacticalrmm': 'TACTICAL_RMM',
  'tacticalrmm-agent': 'TACTICAL_RMM',

  // Fleet MDM
  'FLEET': 'FLEET_MDM',
  'FLEET_MDM': 'FLEET_MDM',
  'FLEET-MDM': 'FLEET_MDM',
  'FLEETMDM': 'FLEET_MDM',
  'fleet': 'FLEET_MDM',
  'fleet_mdm': 'FLEET_MDM',
  'fleet-mdm': 'FLEET_MDM',
  'fleetmdm': 'FLEET_MDM',
  'fleetmdm-agent': 'FLEET_MDM',

  // MeshCentral
  'MESHCENTRAL': 'MESHCENTRAL',
  'MESH': 'MESHCENTRAL',
  'MESH_CENTRAL': 'MESHCENTRAL',
  'MESH-CENTRAL': 'MESHCENTRAL',
  'mesh': 'MESHCENTRAL',
  'meshcentral': 'MESHCENTRAL',
  'mesh_central': 'MESHCENTRAL',
  'mesh-central': 'MESHCENTRAL',
  'meshcentral-agent': 'MESHCENTRAL',

  // Authentik
  'AUTHENTIK': 'AUTHENTIK',
  'authentik': 'AUTHENTIK',

  // OpenFrame
  'OPENFRAME': 'OPENFRAME',
  'openframe': 'OPENFRAME',
  'OPEN_FRAME': 'OPENFRAME',
  'OPEN-FRAME': 'OPENFRAME',
  'open_frame': 'OPENFRAME',
  'open-frame': 'OPENFRAME',

  // OpenFrame Chat
  'OPENFRAME_CHAT': 'OPENFRAME_CHAT',
  'OPENFRAME-CHAT': 'OPENFRAME_CHAT',
  'OPENFRAMECHAT': 'OPENFRAME_CHAT',
  'openframe_chat': 'OPENFRAME_CHAT',
  'openframe-chat': 'OPENFRAME_CHAT',
  'openframechat': 'OPENFRAME_CHAT',

  // OpenFrame Client
  'OPENFRAME_CLIENT': 'OPENFRAME_CLIENT',
  'OPENFRAME-CLIENT': 'OPENFRAME_CLIENT',
  'OPENFRAMECLIENT': 'OPENFRAME_CLIENT',
  'openframe_client': 'OPENFRAME_CLIENT',
  'openframe-client': 'OPENFRAME_CLIENT',
  'openframeclient': 'OPENFRAME_CLIENT',

  // System
  'SYSTEM': 'SYSTEM',
  'system': 'SYSTEM',
}

/**
 * Normalizes a tool name string to the canonical ToolType.
 * Handles various formats like 'tactical', 'TACTICAL_RMM', 'tactical-rmm', etc.
 *
 * @param input - The tool name string to normalize
 * @returns The canonical ToolType, or undefined if no match found
 *
 * @example
 * normalizeToolType('tactical') // => 'TACTICAL_RMM'
 * normalizeToolType('FLEET-MDM') // => 'FLEET_MDM'
 * normalizeToolType('unknown') // => undefined
 */
export function normalizeToolType(input?: string): ToolType | undefined {
  if (!input) return undefined

  // Try exact match first
  const exact = toolAliasMap[input]
  if (exact) return exact

  // Try uppercase
  const upper = input.toUpperCase()
  if (toolAliasMap[upper]) return toolAliasMap[upper]

  // Try lowercase
  const lower = input.toLowerCase()
  if (toolAliasMap[lower]) return toolAliasMap[lower]

  return undefined
}

/**
 * Normalizes a tool name string to the canonical ToolType with a fallback.
 * Returns 'SYSTEM' as the default if no match is found.
 *
 * @param input - The tool name string to normalize
 * @returns The canonical ToolType, defaults to 'SYSTEM' if no match
 *
 * @example
 * normalizeToolTypeWithFallback('tactical') // => 'TACTICAL_RMM'
 * normalizeToolTypeWithFallback('unknown') // => 'SYSTEM'
 */
export function normalizeToolTypeWithFallback(input?: string): ToolType {
  return normalizeToolType(input) ?? 'SYSTEM'
}

/**
 * Converts any tool name variant to its display label.
 * Handles normalization internally.
 *
 * @param input - The tool name string (any format)
 * @returns The display label, or the original input if no match
 *
 * @example
 * toToolLabel('tactical') // => 'Tactical'
 * toToolLabel('FLEET-MDM') // => 'Fleet'
 * toToolLabel('unknown') // => 'unknown'
 */
export function toToolLabel(input?: string): string {
  if (!input) return ''

  const toolType = normalizeToolType(input)
  if (toolType) {
    return toolLabels[toolType]
  }

  return input
}

/**
 * Checks if a string is a valid tool type (or can be normalized to one).
 *
 * @param input - The string to check
 * @returns True if the input can be normalized to a valid ToolType
 *
 * @example
 * isValidToolType('tactical') // => true
 * isValidToolType('FLEET_MDM') // => true
 * isValidToolType('unknown') // => false
 */
export function isValidToolType(input?: string): boolean {
  return normalizeToolType(input) !== undefined
}

/**
 * Gets all valid tool type aliases for a given canonical ToolType.
 * Useful for documentation or validation purposes.
 *
 * @param toolType - The canonical ToolType
 * @returns Array of all aliases that map to this tool type
 */
export function getToolTypeAliases(toolType: ToolType): string[] {
  return Object.entries(toolAliasMap)
    .filter(([_, value]) => value === toolType)
    .map(([key]) => key)
}
