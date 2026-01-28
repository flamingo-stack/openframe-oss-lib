/**
 * Centralized Tool Types
 *
 * Single source of truth for all tool-related types across the entire platform.
 * Used by ToolBadge, ToolIcon, and any component that needs tool type information.
 */

export const ToolTypeValues = {
  TACTICAL_RMM: 'TACTICAL_RMM',
  FLEET_MDM: 'FLEET_MDM',
  MESHCENTRAL: 'MESHCENTRAL',
  AUTHENTIK: 'AUTHENTIK',
  OPENFRAME: 'OPENFRAME',
  OPENFRAME_CHAT: 'OPENFRAME_CHAT',
  OPENFRAME_CLIENT: 'OPENFRAME_CLIENT',
  SYSTEM: 'SYSTEM'
} as const

export type ToolType = (typeof ToolTypeValues)[keyof typeof ToolTypeValues]

/**
 * Maps tool types to display labels
 */
export const toolLabels: Record<ToolType, string> = {
  TACTICAL_RMM: 'TacticalRMM',
  FLEET_MDM: 'Fleet MDM',
  MESHCENTRAL: 'MeshCentral',
  AUTHENTIK: 'Authentik',
  OPENFRAME: 'OpenFrame',
  OPENFRAME_CHAT: 'OpenFrame Chat',
  OPENFRAME_CLIENT: 'OpenFrame Client',
  SYSTEM: 'System'
}

/**
 * Get display label for a tool type
 */
export function getToolLabel(toolType: ToolType): string {
  return toolLabels[toolType] || toolType
}
