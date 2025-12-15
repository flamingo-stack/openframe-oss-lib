/**
 * Centralized Tool Types
 *
 * Single source of truth for all tool-related types across the entire platform.
 * Used by ToolBadge, ToolIcon, and any component that needs tool type information.
 */

export type ToolType =
  | 'TACTICAL_RMM'
  | 'FLEET_MDM'
  | 'MESHCENTRAL'
  | 'AUTHENTIK'
  | 'OPENFRAME'
  | 'OPENFRAME_CHAT'
  | 'OPENFRAME_CLIENT'
  | 'SYSTEM'

/**
 * Maps tool types to display labels
 */
export const toolLabels: Record<ToolType, string> = {
  TACTICAL_RMM: 'Tactical',
  FLEET_MDM: 'Fleet',
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
