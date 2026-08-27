'use client';

import { cn } from '../../utils/cn';
import { Arrow01DownIcon, Arrow01UpIcon, SwitchVrIcon } from '../icons-v2-generated';

export interface SortableColumn {
  key: string;
  label: string;
  sortKey?: string;
}

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  columns: SortableColumn[];
  sortBy?: string;
  sortDirection?: SortDirection;
  title?: string;
}

export interface SortColumnItemProps {
  column: SortableColumn;
  currentDirection?: SortDirection;
  onSort: (direction: SortDirection) => void;
  onClear?: () => void;
}

export function SortColumnItem({ column, currentDirection, onSort, onClear }: SortColumnItemProps) {
  const handleClick = () => {
    if (!currentDirection) {
      onSort('asc');
    } else if (currentDirection === 'asc') {
      onSort('desc');
    } else {
      if (onClear) {
        onClear();
      } else {
        onSort('asc');
      }
    }
  };

  const getSortIcon = () => {
    if (currentDirection === 'asc') {
      return <Arrow01UpIcon className="h-4 w-4 text-ods-accent" />;
    }
    if (currentDirection === 'desc') {
      return <Arrow01DownIcon className="h-4 w-4 text-ods-accent" />;
    }
    return <SwitchVrIcon className="h-4 w-4 text-ods-text-secondary" />;
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex w-full items-center justify-between gap-2 bg-ods-card p-3',
        'cursor-pointer text-left transition-colors hover:bg-ods-bg-hover',
        'border-b border-ods-border last:border-b-0',
      )}
    >
      <span className={cn('flex-1 text-h4', currentDirection ? 'text-ods-text-primary' : 'text-ods-text-secondary')}>
        {column.label}
      </span>
      {getSortIcon()}
    </div>
  );
}
