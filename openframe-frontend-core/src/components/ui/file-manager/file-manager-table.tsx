'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';
import { Checkbox } from '../checkbox';
import { Skeleton } from '../skeleton';
import { FileManagerEmpty } from './file-manager-empty';
import { FileManagerTableRow } from './file-manager-table-row';
import type { FileManagerTableProps } from './types';

export function FileManagerTable({
  files,
  selectedFiles,
  showCheckboxes = true,
  loading = false,
  isSearchResult = false,
  onSelectFile,
  onSelectAll,
  onFileClick,
  onFolderOpen,
  onFileAction,
  className,
}: FileManagerTableProps) {
  const allSelected = useMemo(() => {
    return files.length > 0 && selectedFiles.length === files.length;
  }, [files.length, selectedFiles.length]);

  const someSelected = useMemo(() => {
    return selectedFiles.length > 0 && selectedFiles.length < files.length;
  }, [files.length, selectedFiles.length]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setTableHeight] = useState<number | null>(null);
  // There is nothing to size while the skeleton or the empty state is showing,
  // and that is knowable during render — masking it here means the effect no
  // longer has to write `null` back into state (a second render pass) every
  // time a fetch starts or a filter empties the list.
  const tableHeight = loading || files.length === 0 ? null : measuredHeight;

  useLayoutEffect(() => {
    if (loading || files.length === 0) return undefined;

    const handleResize = () => {
      const node = containerRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const availableHeight = window.innerHeight - rect.top;
      setTableHeight(availableHeight > 0 ? availableHeight : null);
    };

    handleResize();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    const resizeObserver = new ResizeObserver(handleResize);
    const parent = containerRef.current?.parentElement;
    if (parent) {
      resizeObserver.observe(parent);
    } else if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      resizeObserver.disconnect();
    };
  }, [loading, files.length]);

  const handleSelectAll = (checked: boolean) => {
    onSelectAll?.(checked);
  };

  if (loading) {
    const skeletonRows = 8;

    return (
      <div className={cn('flex flex-col rounded-lg border border-ods-border bg-ods-bg', className)}>
        {/* Table header */}
        <div className="flex h-12 items-center rounded-t-lg border-b border-ods-border bg-ods-bg-surface px-4">
          {showCheckboxes && (
            <div className="mr-4">
              <Skeleton className="h-5 w-5 rounded" />
            </div>
          )}

          <div className="flex min-w-0 flex-1 items-center gap-3 text-ods-text-secondary text-h5">NAME</div>

          <div className="w-24 shrink-0 pr-4 text-ods-text-secondary text-h5">SIZE</div>

          <div className="w-36 shrink-0 pl-4 text-ods-text-secondary text-h5">EDITED</div>

          <div className="flex w-48 shrink-0 justify-end pl-4">{/* Space for action buttons */}</div>
        </div>

        {/* Skeleton rows */}
        <div className="flex-1 divide-y divide-ods-border overflow-auto rounded-b-lg">
          {Array.from({ length: skeletonRows }).map((_, idx) => (
            <div key={idx} className="group flex h-16 items-center border-ods-border bg-ods-card px-4">
              {showCheckboxes && (
                <div className="mr-4">
                  <Skeleton className="h-5 w-5 rounded" />
                </div>
              )}

              {/* File icon and name column */}
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Skeleton className="h-6 w-6 rounded" />
                <div className="flex min-w-0 flex-col">
                  <Skeleton className="h-4 w-32" />
                  {isSearchResult && <Skeleton className="mt-1 h-3 w-48" />}
                </div>
              </div>

              {/* Size column */}
              <div className="w-24 shrink-0 pr-4">
                <Skeleton className="h-4 w-16" />
              </div>

              {/* Modified date column */}
              <div className="w-36 shrink-0 pl-4">
                <Skeleton className="h-4 w-24" />
              </div>

              {/* Action buttons column */}
              <div className="flex w-48 shrink-0 items-center justify-end gap-1 pl-4">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return <FileManagerEmpty />;
  }

  return (
    <div
      ref={containerRef}
      className={cn('flex flex-col rounded-lg border border-ods-border bg-ods-bg', className)}
      style={tableHeight ? { height: `${tableHeight}px` } : undefined}
    >
      <div className="flex h-12 items-center rounded-t-lg border-b border-ods-border bg-ods-bg-surface px-4">
        {showCheckboxes && (
          <div className="mr-4">
            <Checkbox checked={allSelected || someSelected} onCheckedChange={handleSelectAll} className="h-5 w-5" />
          </div>
        )}

        <div className="flex min-w-0 flex-1 items-center gap-3 text-ods-text-secondary text-h5">NAME</div>

        <div className="w-24 shrink-0 pr-4 text-ods-text-secondary text-h5">SIZE</div>

        <div className="w-36 shrink-0 pl-4 text-ods-text-secondary text-h5">EDITED</div>

        <div className="flex w-48 shrink-0 justify-end pl-4">{/* Space for action buttons */}</div>
      </div>

      <div className="flex-1 divide-y divide-ods-border overflow-auto rounded-b-lg">
        {files.map(file => (
          <FileManagerTableRow
            key={file.id}
            file={file}
            isSelected={selectedFiles.includes(file.id)}
            showCheckbox={showCheckboxes}
            showPath={isSearchResult}
            onSelect={selected => onSelectFile?.(file.id, selected)}
            onClick={() => {
              if (isSearchResult) {
                onFileClick?.(file);
              } else if (file.type === 'folder') {
                onFolderOpen?.(file);
              }
            }}
            onDoubleClick={() => {
              if (file.type === 'folder' && !isSearchResult) {
                onFolderOpen?.(file);
              }
            }}
            onActionClick={action => onFileAction?.(action, file.id)}
          />
        ))}
      </div>
    </div>
  );
}
