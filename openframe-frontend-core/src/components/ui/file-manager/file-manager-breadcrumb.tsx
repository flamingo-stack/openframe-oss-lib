'use client';

import { ChevronRight } from 'lucide-react';
import React from 'react';
import { cn } from '../../../utils/cn';
import { Button } from '../button';
import type { FileManagerBreadcrumbProps } from './types';

export function FileManagerBreadcrumb({ items, onItemClick, className }: FileManagerBreadcrumbProps) {
  return (
    <nav className={cn('flex flex-wrap items-center gap-x-1 gap-y-1 break-words text-h6', className)}>
      {items.map((item, index) => (
        <React.Fragment key={item.path}>
          {index > 0 && <ChevronRight className="h-4 w-4 flex-shrink-0 text-ods-text-tertiary" />}
          <Button
            variant="link"
            size="compact"
            noPaddingX
            type="button"
            data-tone="primary"
            aria-current={index === items.length - 1 ? 'page' : undefined}
            onClick={() => onItemClick?.(item.path)}
            className="shrink-0"
          >
            {item.label}
          </Button>
        </React.Fragment>
      ))}
    </nav>
  );
}
