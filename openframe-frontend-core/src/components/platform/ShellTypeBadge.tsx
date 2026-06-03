/**
 * ShellTypeBadge Component
 *
 * Displays a badge for shell/script types with appropriate icon and label.
 * Supports all Tactical RMM shell types.
 */

import React from 'react'
import { PowershellLogoIcon } from '../icons-v2-generated/brand-logos/powershell-logo-icon'
import { PythonLogoIcon } from '../icons-v2-generated/brand-logos/python-logo-icon'

import { ShellType, ShellTypeValues } from '../../types/shell.types'
import { getShellLabel } from '../../utils/shell-utils'
import { cn } from '../../utils/cn'
import {
  BashIcon,
  CmdIcon,
  DenoIcon,
  NushellIcon,
  ShellIcon
} from '../icons'

/**
 * Shell icon configuration with typed mapping
 */
interface ShellIconConfig {
  icon: React.ComponentType<{ size?: number; color?: string; className?: string }>
  props: { size: number } & ({ className: string } | { color: string })
}

/**
 * Typed mapping of shell types to their icon configurations
 * Using Record<ShellType, ...> ensures all shell types are covered
 */
const shellIconMap: Record<ShellType, ShellIconConfig> = {
  [ShellTypeValues.POWERSHELL]: {
    icon: PowershellLogoIcon,
    props: { size: 16, className: 'text-ods-text-secondary' }
  },
  [ShellTypeValues.CMD]: {
    icon: CmdIcon,
    props: { size: 16, color: '#888888' }
  },
  [ShellTypeValues.BASH]: {
    icon: BashIcon,
    props: { size: 16, color: '#888888' }
  },
  [ShellTypeValues.PYTHON]: {
    icon: PythonLogoIcon,
    props: { size: 16, className: 'text-ods-text-secondary' }
  },
  [ShellTypeValues.NUSHELL]: {
    icon: NushellIcon,
    props: { size: 16, color: '#888888' }
  },
  [ShellTypeValues.DENO]: {
    icon: DenoIcon,
    props: { size: 16, color: '#888888' }
  },
  [ShellTypeValues.SHELL]: {
    icon: ShellIcon,
    props: { size: 16, color: '#888888' }
  }
} as const

const defaultIconConfig: ShellIconConfig = {
  icon: ShellIcon,
  props: { size: 16, color: '#888888' }
}

export interface ShellTypeBadgeProps {
  shellType: ShellType
  className?: string
  iconClassName?: string
}

export const ShellTypeBadge: React.FC<ShellTypeBadgeProps> = ({
  shellType,
  className,
  iconClassName
}) => {
  const normalizedType = shellType?.toUpperCase() as ShellType
  const label = getShellLabel(normalizedType)
  const { icon: IconComponent, props: iconProps } = shellIconMap[normalizedType] ?? defaultIconConfig
  const defaultIconClassName = 'className' in iconProps ? iconProps.className : undefined

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <IconComponent size={16} className={cn(defaultIconClassName, iconClassName)} />
      <span className="text-ods-text-primary text-h4">{label}</span>
    </div>
  )
}

ShellTypeBadge.displayName = 'ShellTypeBadge'
