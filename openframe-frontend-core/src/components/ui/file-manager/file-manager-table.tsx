'use client';

import { useMemo } from 'react';
import { cn } from '../../../utils/cn';
import { Checkbox } from '../checkbox';
import { LoadingItems, useLoadingScope } from '../loading-scope';
import { FileManagerEmpty } from './file-manager-empty';
import {
  FILE_MANAGER_ACTIONS_CELL_BOX_CLASS,
  FILE_MANAGER_CHECKBOX_BOX_CLASS,
  FILE_MANAGER_CHECKBOX_CELL_CLASS,
  FILE_MANAGER_MODIFIED_CELL_BOX_CLASS,
  FILE_MANAGER_NAME_CELL_CLASS,
  FILE_MANAGER_SIZE_CELL_BOX_CLASS,
  FileManagerTableRow,
} from './file-manager-table-row';
import type { FileManagerTableProps } from './types';

/** Rows a loading file list draws: a typical folder, since a folder listing has no page size (module export only,
 *  not public). */
/** A header cell's label type. */
const HEADER_LABEL_CLASS = 'text-ods-text-secondary text-h5';
const FILE_MANAGER_SKELETON_ROWS = 8;

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

  const handleSelectAll = (checked: boolean) => {
    onSelectAll?.(checked);
  };

  if (!loading && files.length === 0) {
    return <FileManagerEmpty />;
  }

  return (
    // The height its parent gives it, both forms: the rows scroll inside, under the header. Not
    // the window's: whatever is below the parent (a docked composer, a page's padding) would
    // hide the last rows under it. A parent of no definite height lets the table grow with its rows.
    // `overflow-hidden` rounds the header and the rows at the border's inner curve: a child rounded
    // to the frame's own radius sits 1px inside it and leaves a sliver of the frame's fill at each
    // corner. Nothing floats out of the table (the row menu is portalled).
    <div
      className={cn('flex h-full flex-col overflow-hidden rounded-lg border border-ods-border bg-ods-bg', className)}
    >
      {/* ONE header in both forms: the column labels are copy, and while the folder is read the select-all box is the
          real checkbox, inert. */}
      <div className="flex h-12 items-center border-b border-ods-border bg-ods-bg-surface px-4">
        {showCheckboxes && (
          <div
            className={FILE_MANAGER_CHECKBOX_CELL_CLASS}
            inert={loading || undefined}
            aria-hidden={loading || undefined}
          >
            <Checkbox
              checked={allSelected || someSelected}
              onCheckedChange={handleSelectAll}
              boxClassName={FILE_MANAGER_CHECKBOX_BOX_CLASS}
            />
          </div>
        )}

        <div className={cn(FILE_MANAGER_NAME_CELL_CLASS, HEADER_LABEL_CLASS)}>NAME</div>

        <div className={cn(FILE_MANAGER_SIZE_CELL_BOX_CLASS, HEADER_LABEL_CLASS)}>SIZE</div>

        <div className={cn(FILE_MANAGER_MODIFIED_CELL_BOX_CLASS, HEADER_LABEL_CLASS)}>EDITED</div>

        <div className={FILE_MANAGER_ACTIONS_CELL_BOX_CLASS}>{/* Space for action buttons */}</div>
      </div>

      <div className="flex-1 divide-y divide-ods-border overflow-auto">
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
