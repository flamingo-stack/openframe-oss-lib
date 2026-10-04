/**
 * ToolBadge Component
 *
 * Displays a tool type badge with icon for OpenFrame integrated tools.
 * Used in tables to show tool sources like Fleet MDM, MeshCentral, etc.
 */

import type React from 'react';
import type { ToolType } from '../../types/tool.types';
import { cn } from '../../utils/cn';
import { getToolLabel } from '../../utils/tool-utils';
import { ToolIcon } from '../tool-icon';

export type { ToolType } from '../../types/tool.types';

export interface ToolBadgeProps {
  /** A built-in tool: its label and grey mark come from the tool registry. */
  toolType?: ToolType;
  /** The text. Required without `toolType`; with it, replaces the registry label. */
  label?: string;
  /** The mark. Required for a tool outside the registry; replaces the registry mark otherwise. */
  icon?: React.ReactNode;
  /**
   * `inline` (default): mark and label in the surrounding text (a table cell).
   * `chip`: a 28px dark chip with a monochrome mark, for a row of "built on"
   * badges on a card.
   */
  variant?: 'inline' | 'chip';
  /** Additional CSS classes */
  className?: string;
  iconClassName?: string;
}

/**
 * One tool, named: a mark and a label. Pass a `toolType` for a tool the
 * registry knows, or `label` + `icon` for one it does not (a connector or a
 * package manager that is content, not a built-in tool).
 */
export const ToolBadge: React.FC<ToolBadgeProps> = ({
  toolType,
  label,
  icon,
  variant = 'inline',
  className,
  iconClassName,
}) => {
  const text = label ?? (toolType ? getToolLabel(toolType) : '');
  const mark = icon ?? (toolType ? <ToolIcon toolType={toolType} className={iconClassName} size={16} /> : null);

  if (variant === 'chip') {
    return (
      <span
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-md border border-ods-border px-2 text-ods-text-secondary text-h6',
          className,
        )}
      >
        {mark && (
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center [&_img]:h-full [&_img]:w-full [&_img]:object-contain [&_svg]:h-full [&_svg]:w-full">
            {mark}
          </span>
        )}
        {text && <span className="whitespace-nowrap">{text}</span>}
      </span>
    );
  }

  return (
    <div className={cn('flex items-center gap-1 text-ods-text-secondary', className)}>
      {mark}
      <span className="text-ods-text-primary text-h4">{text}</span>
    </div>
  );
};

ToolBadge.displayName = 'ToolBadge';
