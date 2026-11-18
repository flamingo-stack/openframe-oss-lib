'use client';

import { cn } from '../../../utils/cn';
import { TextLineSkeleton, UnifiedSkeleton } from '../../loading/unified-skeleton';
import { DataTableCell } from '../../ui/data-table/data-table-cell';
import { useLoadingScope } from '../../ui/loading-scope';
import { scriptShellType } from './shell-types';

export interface ScriptShellBadgeProps {
  /** Lowercase shell id (`'cmd'`). */
  value: string;
  className?: string;
  iconClassName?: string;
}

/** A script's shell: its icon and label from `SCRIPT_SHELL_TYPES`. */
export function ScriptShellBadge({ value, className, iconClassName }: ScriptShellBadgeProps) {
  // The shell is still being read (empty, in a loading scope): its icon box and its label as bars.
  if (useLoadingScope() && !value) {
    return (
      <span className={cn('flex items-center gap-2', className)}>
        <UnifiedSkeleton className={cn('h-5 w-5', iconClassName)} />
        <TextLineSkeleton type="inherit" as="span" className="w-20" />
      </span>
    );
  }
  const shell = scriptShellType(value);
  const Icon = shell?.icon;

  return (
    <span className={cn('flex items-center gap-2', className)}>
      {/* `iconClassName` comes last so a caller keeps the size and the colour. */}
      {Icon && <Icon className={cn('h-5 w-5 text-ods-text-secondary', iconClassName)} />}
      <span>{shell?.label ?? value}</span>
    </span>
  );
}

/** A script's shell in a grid table's cell: its icon and label on one line; a bar while the shell is read. */
export function ScriptShellGridCell({ value }: { value: string }) {
  const shell = scriptShellType(value);
  const Icon = shell?.icon;
  return (
    <DataTableCell
      leading={Icon ? { type: 'icon', icon: <Icon className="size-5" /> } : undefined}
      text={shell?.label ?? value}
    />
  );
}
