'use client';

import { ChevronRight } from 'lucide-react';
import React from 'react';
import { cn } from '../../../utils/cn';
import type { FileManagerBreadcrumbProps } from './types';

export function FileManagerBreadcrumb({ items, onItemClick, className }: FileManagerBreadcrumbProps) {
  return (
    <nav className={cn('flex flex-wrap items-center gap-x-1 gap-y-1 break-words text-h6', className)}>
      {items.map((item, index) => (
        <React.Fragment key={item.path}>
          {index > 0 && <ChevronRight className="h-4 w-4 flex-shrink-0 text-ods-text-tertiary" />}
          <button
            onClick={() => onItemClick?.(item.path)}
            className={cn(
              'shrink-0 rounded px-1 py-0.5 transition-colors hover:bg-ods-bg-hover',
              'break-all text-left text-ods-text-primary hover:text-ods-accent',
              index === items.length - 1 && 'font-medium',
            )}
          >
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}
