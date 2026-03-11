'use client';

import { FileX2 } from 'lucide-react';
import React from 'react';
import { cn } from '../../../utils/cn';
import { Button } from '../button';
import type { TableEmptyStateProps } from './types';

export function TableEmptyState({ message = 'No data available', icon, action, className }: TableEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 rounded-[6px] bg-[var(--ods-system-greys-black)] border border-[var(--ods-system-greys-soft-grey)]',
        className,
      )}
    >
      {/* Icon */}
      <div className="mb-4 text-[var(--ods-system-greys-grey)]">{icon || <FileX2 className="w-12 h-12" />}</div>

      {/* Message */}
      <p className="text-h4 text-[var(--ods-system-greys-grey)] text-center mb-6">{message}</p>

      {/* Action Button */}
      {action && (
        <Button
          variant="outline"
          onClick={action.onClick}
          className="bg-[var(--ods-system-greys-black)] border-[var(--ods-system-greys-soft-grey)] hover:bg-[var(--ods-system-greys-background-action)] text-[var(--ods-system-greys-white)]"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
