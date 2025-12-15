'use client'

import React from 'react'
import { cn } from '../../utils/cn'

interface TabContentProps {
  activeTab: string
  TabComponent: React.ComponentType<any> | null
  componentProps?: any
  className?: string
  emptyStateTitle?: string
  emptyStateDescription?: string
  minHeight?: string
}

export function TabContent({
  activeTab,
  TabComponent,
  componentProps,
  className,
  emptyStateTitle = "Tab Not Found",
  emptyStateDescription,
  minHeight = "min-h-[400px]"
}: TabContentProps) {
  const defaultDescription = `The selected tab "${activeTab}" could not be found.`

  return (
    <div className={cn(minHeight, className)}>
      {TabComponent ? (
        <TabComponent {...componentProps} />
      ) : (
        <div className={cn(minHeight, "flex items-center justify-center")}>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-ods-text-primary mb-2">
              {emptyStateTitle}
            </h3>
            <p className="text-ods-text-secondary">
              {emptyStateDescription || defaultDescription}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}