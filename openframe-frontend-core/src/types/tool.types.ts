/**
 * Centralized Tool Types
 *
 * Single source of truth for all tool-related types across the entire platform.
 * Used by ToolBadge, ToolIcon, and any component that needs tool type information.
 */

export const ToolTypeValues = {
  FLEET_MDM: 'FLEET_MDM',
  MESHCENTRAL: 'MESHCENTRAL',
  AUTHENTIK: 'AUTHENTIK',
  OPENFRAME: 'OPENFRAME',
  OPENFRAME_CHAT: 'OPENFRAME_CHAT',
  OPENFRAME_CLIENT: 'OPENFRAME_CLIENT',
  OPENFRAME_RMM: 'OPENFRAME_RMM',
  OSQUERY: 'OSQUERY',
  SYSTEM: 'SYSTEM',
  // Directory tenants (Tenant Management): the same identifiers the gateway's
  // DirectoryProvider enum uses, so a directory sync's log rows resolve here.
  MICROSOFT_365: 'MICROSOFT_365',
  GOOGLE_WORKSPACE: 'GOOGLE_WORKSPACE',
} as const;

export type ToolType = (typeof ToolTypeValues)[keyof typeof ToolTypeValues];

/**
 * Maps tool types to display labels
 */
export const toolLabels: Record<ToolType, string> = {
  FLEET_MDM: 'Fleet',
  MESHCENTRAL: 'MeshCentral',
  AUTHENTIK: 'Authentik',
  OPENFRAME: 'OpenFrame',
  OPENFRAME_CHAT: 'OpenFrame Chat',
  OPENFRAME_CLIENT: 'OpenFrame Client',
  OPENFRAME_RMM: 'RMM',
  OSQUERY: 'Osquery',
  SYSTEM: 'System',
  MICROSOFT_365: 'Microsoft 365',
  GOOGLE_WORKSPACE: 'Google Workspace',
};
