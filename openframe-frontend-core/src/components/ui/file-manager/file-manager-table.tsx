'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';
import { Checkbox } from '../checkbox';
import { LoadingItems, useLoadingScope } from '../loading-scope';
import { FileManagerEmpty } from './file-manager-empty';
import { FILE_MANAGER_CHECKBOX_BOX_CLASS, FileManagerTableRow } from './file-manager-table-row';
import type { FileManagerTableProps } from './types';

/** Rows a loading file list draws: a typical folder, since a folder listing has no page size (module export only,
 *  not public). */
export const FILE_MANAGER_SKELETON_ROWS = 8;

export function FileManagerTable({
  files,
  selectedFiles,
  showCheckboxes = true,
  loading: loadingProp = false,
  isSearchResult = false,
  onSelectFile,
  onSelectAll,
  onFileClick,
  onFolderOpen,
  onFileAction,
  className,
}: FileManagerTableProps) {
  // ONE switch: in a loading scope or while the host reads the folder, the table draws its loading rows.
  const loading = useLoadingScope() || loadingProp;
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

  if (!loading && files.length === 0) {
    return <FileManagerEmpty />;
  }

  return (
    <div
      ref={containerRef}
      className={cn('flex flex-col rounded-lg border border-ods-border bg-ods-bg', className)}
      style={tableHeight ? { height: `${tableHeight}px` } : undefined}
    >
      {/* ONE header in both forms: the column labels are copy, and while the folder is read the select-all box is the
          real checkbox, inert. */}
      <div className="flex h-12 items-center rounded-t-lg border-b border-ods-border bg-ods-bg-surface px-4">
        {showCheckboxes && (
          <div className="mr-4" inert={loading || undefined} aria-hidden={loading || undefined}>
            <Checkbox
              checked={allSelected || someSelected}
              onCheckedChange={handleSelectAll}
              boxClassName={FILE_MANAGER_CHECKBOX_BOX_CLASS}
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 items-center gap-3 text-ods-text-secondary text-h5">NAME</div>

        <div className="w-24 shrink-0 pr-4 text-ods-text-secondary text-h5">SIZE</div>

        <div className="w-36 shrink-0 pl-4 text-ods-text-secondary text-h5">EDITED</div>

        <div className="flex w-48 shrink-0 justify-end pl-4">{/* Space for action buttons */}</div>
      </div>

      <div className="flex-1 divide-y divide-ods-border overflow-auto rounded-b-lg">
        {loading ? (
          // A folder listing has no page size: a typical folder's rows, each the row's own loading form.
          <LoadingItems count={FILE_MANAGER_SKELETON_ROWS}>
            {() => (
              <FileManagerTableRow loading showCheckbox={showCheckboxes} showPath={isSearchResult} data-loading-item />
            )}
          </LoadingItems>
        ) : (
          files.map(file => (
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
              data-loading-item
            />
          ))
        )}
      </div>
    </div>
  );
}
