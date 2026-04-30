/**
 * ToolBadge Component
 *
 * Displays a tool type badge with icon for OpenFrame integrated tools.
 * Used in tables to show tool sources like Tactical RMM, Fleet MDM, etc.
 *
 * @example
 * ```tsx
 * <ToolBadge toolType="TACTICAL" />
 * <ToolBadge toolType="FLEET" />
 * <ToolBadge toolType="MESHCENTRAL" />
 * ```
 */

import React from 'react'
import { ToolType } from '../../types/tool.types'
import { getToolLabel } from '../../utils/tool-utils'
import { cn } from '../../utils/cn'
import { ToolIcon } from '../tool-icon'

export type { ToolType } from '../../types/tool.types'

export interface ToolBadgeProps {
  /** Tool type */
  toolType: ToolType
  /** Additional CSS classes */
  className?: string
  iconClassName?: string
}

export const ToolBadge: React.FC<ToolBadgeProps> = ({
  toolType,
  className,
  iconClassName,
}) => {
  const label = getToolLabel(toolType)

  return (
    <div className={cn("flex items-center gap-1 text-ods-text-secondary", className)}>
      <ToolIcon toolType={toolType} className={iconClassName} size={16} />
      <span className="text-ods-text-primary text-h4">{label}</span>
    </div>
  )
}

ToolBadge.displayName = 'ToolBadge'
