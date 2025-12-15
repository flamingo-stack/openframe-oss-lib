'use client'

import React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../../utils/cn'
import type { FileManagerBreadcrumbProps } from './types'

export function FileManagerBreadcrumb({ 
  items, 
  onItemClick, 
  className 
}: FileManagerBreadcrumbProps) {
  return (
    <nav className={cn(
      'flex flex-wrap items-center gap-x-1 gap-y-1 text-sm break-words',
      className
    )}>
      {items.map((item, index) => (
        <React.Fragment key={item.path}>
          {index > 0 && (
            <ChevronRight className="h-4 w-4 text-ods-text-tertiary flex-shrink-0" />
          )}
          <button
            onClick={() => onItemClick?.(item.path)}
            className={cn(
              'px-1 py-0.5 rounded hover:bg-ods-bg-secondary transition-colors',
              'text-ods-text-primary hover:text-ods-accent text-left break-all',
              index === items.length - 1 && 'font-medium'
            )}
          >
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </nav>
  )
}