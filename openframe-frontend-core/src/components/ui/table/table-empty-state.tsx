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
        'flex flex-col items-center justify-center py-12 px-4 rounded-[6px] bg-ods-card border border-ods-border',
        className,
      )}
    >
      {/* Icon */}
      <div className="mb-4 text-ods-text-secondary">{icon || <FileX2 className="w-12 h-12" />}</div>

      {/* Message */}
      <p className="text-h4 text-ods-text-secondary text-center mb-6">{message}</p>

      {/* Action Button */}
      {action && (
        <Button
          variant="outline"
          onClick={action.onClick}
          className="bg-ods-card border-ods-border hover:bg-ods-bg-active text-ods-text-primary"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
