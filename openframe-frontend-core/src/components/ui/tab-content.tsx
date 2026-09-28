'use client';

import React from 'react';
import { cn } from '../../utils/cn';

/**
 * `TabComponent` and `componentProps` are ONE unit: the panel's props type is
 * inferred from the bag the caller passes, so the two can no longer drift.
 */
interface TabContentProps<P extends object = Record<string, never>> {
  activeTab: string;
  TabComponent: React.ComponentType<P> | null;
  componentProps?: P;
  className?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  minHeight?: string;
}

export function TabContent<P extends object = Record<string, never>>({
  activeTab,
  TabComponent,
  componentProps,
  className,
  emptyStateTitle = 'Tab Not Found',
  emptyStateDescription,
  minHeight = 'min-h-[400px]',
}: TabContentProps<P>) {
  const defaultDescription = `The selected tab "${activeTab}" could not be found.`;

  return (
    <div className={cn(minHeight, className)}>
      {TabComponent ? (
        // `createElement` (not `<TabComponent {...componentProps} />`) so the
        // optional bag can be omitted entirely without asserting an empty `P`.
        React.createElement(TabComponent, componentProps ?? null)
      ) : (
        <div className={cn(minHeight, 'flex items-center justify-center')}>
          <div className="text-center">
            <h3 className="mb-2 text-ods-text-primary text-h3">{emptyStateTitle}</h3>
            <p className="text-ods-text-secondary">{emptyStateDescription || defaultDescription}</p>
          </div>
        </div>
      )}
    </div>
  );
}
