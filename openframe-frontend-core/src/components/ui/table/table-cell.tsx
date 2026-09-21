'use client';

import { cn } from '../../../utils/cn';
import type { TableCellProps } from './types';

/** @deprecated Use `DataTable` from `data-table` instead. */
export function TableCell({ children, align = 'left', className, width }: TableCellProps) {
  const getAlignment = () => {
    switch (align) {
      case 'center':
        return 'justify-center text-center';
      case 'right':
        return 'justify-end text-right';
      default:
        return 'justify-start text-left';
    }
  };

  return (
    <div className={cn('flex flex-col overflow-hidden', getAlignment(), width || 'min-w-0 flex-1', className)}>
      {typeof children === 'string' || typeof children === 'number' ? (
        <span className="truncate text-ods-text-primary text-h4">{children}</span>
      ) : (
        children
      )}
    </div>
  );
}
