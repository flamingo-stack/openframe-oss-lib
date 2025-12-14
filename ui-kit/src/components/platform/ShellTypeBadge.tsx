/**
 * ShellTypeBadge Component
 *
 * Displays a badge for shell/script types with appropriate icon and label.
 * Supports all Tactical RMM shell types.
 */

import React from 'react'
import { Button } from '../ui/button'
import {
  PowerShellIcon,
  CmdIcon,
  BashIcon,
  PythonIcon,
  NushellIcon,
  DenoIcon,
  ShellIcon
} from '../icons'
import { cn } from '../../utils/cn'
import { ShellType, getShellLabel } from '../../types/shell.types'

export interface ShellTypeBadgeProps {
  /** Shell type */
  shellType: ShellType
  /** Additional CSS classes */
  className?: string
}

export const ShellTypeBadge: React.FC<ShellTypeBadgeProps> = ({
  shellType,
  className
}) => {
  // Normalize shell type to uppercase
  const normalizedType = shellType?.toUpperCase() as ShellType
  const label = getShellLabel(normalizedType)

  // Get the appropriate icon based on shell type
  const renderIcon = () => {
    switch (normalizedType) {
      case 'POWERSHELL':
        return <PowerShellIcon size={16} />
      case 'CMD':
        return <CmdIcon size={16} />
      case 'BASH':
        return <BashIcon size={16} />
      case 'PYTHON':
        return <PythonIcon size={16} />
      case 'NUSHELL':
        return <NushellIcon size={16} />
      case 'DENO':
        return <DenoIcon size={16} />
      case 'SHELL':
        return <ShellIcon size={16} />
      default:
        return <ShellIcon size={16} />
    }
  }

  return (
    <Button
      variant="table-display"
      size="none"
      leftIcon={renderIcon()}
      className={cn(className)}
      alignment='left'
    >
      {label}
    </Button>
  )
}

ShellTypeBadge.displayName = 'ShellTypeBadge'
