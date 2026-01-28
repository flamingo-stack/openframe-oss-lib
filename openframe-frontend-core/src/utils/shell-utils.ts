/**
 * Shell Type Utilities
 *
 * Helper functions for working with shell types.
 */

import React from 'react'
import { ShellType, SHELL_TYPES, shellLabels } from '@/types/shell.types'

/**
 * Get display label for a shell type
 */
export function getShellLabel(shellType?: string): string {
  if (!shellType) return 'Unknown'
  const normalized = shellType.toUpperCase() as ShellType
  return shellLabels[normalized] || shellType
}

/**
 * Get icon component for a shell type
 */
export function getShellIcon(shellType?: string): React.ComponentType<{ className?: string }> | undefined {
  if (!shellType) return undefined
  const normalized = shellType.toUpperCase() as ShellType
  const shellDef = SHELL_TYPES.find(s => s.id === normalized)
  return shellDef?.icon
}
