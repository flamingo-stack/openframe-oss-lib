'use client';

import { cn } from '../../../utils/cn';
import { scriptShellType } from './shell-types';

export interface ScriptShellBadgeProps {
  /** Lowercase shell id (`'cmd'`). */
  value: string;
  className?: string;
  iconClassName?: string;
}

/** A script's shell: its icon and label from `SCRIPT_SHELL_TYPES`. */
export function ScriptShellBadge({ value, className, iconClassName }: ScriptShellBadgeProps) {
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
