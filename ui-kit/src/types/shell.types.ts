/**
 * Centralized Shell Types
 *
 * Single source of truth for all shell/script type information across the platform.
 * Based on Tactical RMM supported shell types.
 */

import React from 'react'
import {
  PowerShellIcon,
  CmdIcon,
  BashIcon,
  PythonIcon,
  NushellIcon,
  DenoIcon,
  ShellIcon
} from '../components/icons'

export type ShellType =
  | 'POWERSHELL'
  | 'CMD'
  | 'BASH'
  | 'PYTHON'
  | 'NUSHELL'
  | 'DENO'
  | 'SHELL'

/**
 * Shell type definition with all metadata
 */
export interface ShellTypeDefinition {
  id: string
  label: string
  value: string
  icon: React.ReactNode
}

/**
 * Complete list of all shell types with icons and labels
 * SINGLE SOURCE OF TRUTH - Use this everywhere
 */
export const SHELL_TYPES: ShellTypeDefinition[] = [
  { id: 'POWERSHELL', label: 'PowerShell', value: 'powershell', icon: React.createElement(PowerShellIcon, { size: 16 }) },
  { id: 'CMD', label: 'Batch', value: 'cmd', icon: React.createElement(CmdIcon, { size: 16 }) },
  { id: 'PYTHON', label: 'Python', value: 'python', icon: React.createElement(PythonIcon, { size: 16 }) },
  { id: 'NUSHELL', label: 'Nu', value: 'nushell', icon: React.createElement(NushellIcon, { size: 16 }) },
  { id: 'DENO', label: 'Deno', value: 'deno', icon: React.createElement(DenoIcon, { size: 16 }) },
  { id: 'SHELL', label: 'Shell', value: 'shell', icon: React.createElement(ShellIcon, { size: 16 }) },
]

/**
 * Maps shell types to display labels
 */
export const shellLabels: Record<ShellType, string> = {
  POWERSHELL: 'PowerShell',
  CMD: 'Batch',
  BASH: 'Bash',
  PYTHON: 'Python',
  NUSHELL: 'Nu',
  DENO: 'Deno',
  SHELL: 'Shell'
}

/**
 * Get display label for a shell type
 */
export function getShellLabel(shellType: ShellType): string {
  return shellLabels[shellType] || shellType
}
