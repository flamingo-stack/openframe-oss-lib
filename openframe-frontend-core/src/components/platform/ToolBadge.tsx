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
import { Button } from '../ui/button'
import { ToolIcon } from '../tool-icon'
import { cn } from '../../utils/cn'
import { ToolType, getToolLabel } from '../../types/tool.types'

export type { ToolType } from '../../types/tool.types'

export interface ToolBadgeProps {
  /** Tool type */
  toolType: ToolType
  /** Additional CSS classes */
  className?: string
}

export const ToolBadge: React.FC<ToolBadgeProps> = ({
  toolType,
  className
}) => {
  const label = getToolLabel(toolType)

  return (
    <Button
      variant="table-display"
      size="none"
      leftIcon={<ToolIcon toolType={toolType as any} size={16} />}
      className={cn(className)}
      alignment='left'
    >
      {label}
    </Button>
  )
}

ToolBadge.displayName = 'ToolBadge'
