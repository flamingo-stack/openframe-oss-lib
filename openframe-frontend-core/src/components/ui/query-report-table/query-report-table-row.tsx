'use client';

import { useRef, useState, useCallback } from 'react';
import { cn } from '../../../utils/cn';
import {
  DATA_TABLE_ROW_FRAME_CLASS,
  ROW_HEIGHT_DESKTOP,
  ROW_SHELL_CLASSES,
} from '../data-table/data-table-row-classes';
import { loadingItemProps } from '../loading-scope';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../tooltip';
import type { QueryReportTableRowProps } from './types';

/**
 * The report's row boxes, loaded and loading, from the data table's row class set (`data-table-row-classes`): the
 * default row is the data table's card, shell and height; a compact row a divided 56px line in the same shell.
 */
export const queryReportRowFrameClass = (compact: boolean) =>
  compact ? 'border-b border-ods-border' : cn('relative', DATA_TABLE_ROW_FRAME_CLASS);
export const queryReportRowCellsClass = (compact: boolean) =>
  cn('flex', ROW_SHELL_CLASSES, compact ? 'h-[56px]' : ROW_HEIGHT_DESKTOP);
/** The header's row: the rows' shell, so each header cell sits over its column. */
export const queryReportHeaderClass = (compact: boolean) =>
  cn('flex', ROW_SHELL_CLASSES, compact && 'border-b border-ods-border py-2');
/** One header cell's box (48px high), loaded and loading. */
export const QUERY_REPORT_HEADER_CELL_CLASS = 'flex h-12 shrink-0 items-center';
/** The rows' stack and the gap between rows, loaded and loading. */
export const queryReportRowsClass = (compact: boolean) =>
  cn('flex flex-col', compact ? 'gap-0' : 'gap-[var(--spacing-system-xs)]');
/** One cell's box, loaded and loading. */
export const QUERY_REPORT_CELL_CLASS = 'flex shrink-0 flex-col justify-center overflow-hidden';

export function QueryReportTableRow({
  row,
  columns,
  columnWidth,
  variant = 'default',
  className,
  ...props
}: QueryReportTableRowProps) {
  const isCompact = variant === 'compact';

  return (
    <div
      // A list's markers (`data-loading-item`) ride on the row, as on its loading form's rows.
      {...loadingItemProps(props)}
      className={cn(queryReportRowFrameClass(isCompact), className)}
    >
      <div className={queryReportRowCellsClass(isCompact)}>
        {columns.map(column => {
          const value = row[column];
          const displayValue = value === null || value === undefined ? '-' : String(value);
          return (
            <div key={column} className={QUERY_REPORT_CELL_CLASS} style={{ width: columnWidth }}>
              <TruncatedCell
                className={cn('text-ods-text-primary', isCompact ? 'text-h6' : 'text-h4')}
                value={displayValue}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TruncatedCell({ value, className }: { value: string; className?: string }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const checkTruncation = useCallback(() => {
    const el = textRef.current;
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    }
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip open={isTruncated ? undefined : false}>
        <TooltipTrigger asChild onMouseEnter={checkTruncation}>
          <span ref={textRef} className={cn('block truncate', className)}>
            {value}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs break-words">
          {value}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
