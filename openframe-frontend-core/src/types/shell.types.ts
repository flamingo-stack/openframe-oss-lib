/**
 * Centralized Shell Types
 *
 * Single source of truth for all shell/script type information across the platform.
 * Based on Tactical RMM supported shell types.
 */
import { PowershellLogoIcon } from '../components/icons-v2-generated/brand-logos/powershell-logo-icon'
import { PythonLogoIcon } from '../components/icons-v2-generated/brand-logos/python-logo-icon'
import {
  BashIcon,
  CmdIcon,
  DenoIcon,
  NushellIcon,
  ShellIcon
} from '../components/icons'
import type { IconProps } from './icons'



export const ShellTypeValues = {
  POWERSHELL: 'POWERSHELL',
  CMD: 'CMD',
  BASH: 'BASH',
  PYTHON: 'PYTHON',
  NUSHELL: 'NUSHELL',
  DENO: 'DENO',
  SHELL: 'SHELL'
} as const

export type ShellType = (typeof ShellTypeValues)[keyof typeof ShellTypeValues]

/**
 * Shell type definition with all metadata
 */
export interface ShellTypeDefinition {
  id: ShellType
  label: string
  value: string
  icon: React.ComponentType<IconProps>
}

/**
 * Complete list of all shell types with icons and labels
 * SINGLE SOURCE OF TRUTH - Use this everywhere
 */
export const SHELL_TYPES: ShellTypeDefinition[] = [
  { id: ShellTypeValues.POWERSHELL, label: 'PowerShell', value: 'powershell', icon: PowershellLogoIcon },
  { id: ShellTypeValues.CMD, label: 'Batch', value: 'cmd', icon: CmdIcon },
  { id: ShellTypeValues.BASH, label: 'Bash', value: 'bash', icon: BashIcon },
  { id: ShellTypeValues.PYTHON, label: 'Python', value: 'python', icon: PythonLogoIcon },
  { id: ShellTypeValues.NUSHELL, label: 'Nu', value: 'nushell', icon: NushellIcon },
  { id: ShellTypeValues.DENO, label: 'Deno', value: 'deno', icon: DenoIcon },
  { id: ShellTypeValues.SHELL, label: 'Shell', value: 'shell', icon: ShellIcon },
]

/**
 * Maps shell types to display labels
 */
export const shellLabels: Record<ShellType, string> = {
  [ShellTypeValues.POWERSHELL]: 'PowerShell',
  [ShellTypeValues.CMD]: 'Batch',
  [ShellTypeValues.BASH]: 'Bash',
  [ShellTypeValues.PYTHON]: 'Python',
  [ShellTypeValues.NUSHELL]: 'Nu',
  [ShellTypeValues.DENO]: 'Deno',
  [ShellTypeValues.SHELL]: 'Shell'
}
