'use client';

import { ChevronRight, MoreHorizontal } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { cn } from '../../../utils/cn';
import { TextLineSkeleton, UnifiedSkeleton } from '../../loading/unified-skeleton';
import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { loadingItemProps, useLoadingScope } from '../loading-scope';
import { FileIcon } from './file-icon';
import { FileManagerContextMenu } from './file-manager-context-menu';
import type { FileAction, FileManagerTableRowProps } from './types';

/** A file row's frame (its height, inset and surface): read by the row and by its loading form, so both are one box. */
export const FILE_MANAGER_ROW_FRAME_CLASS = 'group flex h-16 items-center border-ods-border bg-ods-card px-4';
/** The checkbox's box in a file row and in the table header, in both forms. */
export const FILE_MANAGER_CHECKBOX_BOX_CLASS = 'h-5 w-5';
/** The row's icon buttons ("…" and the folder's chevron), and the bar that stands for the chevron while loading. */
const ROW_ICON_BUTTON_CLASS = 'h-8 w-8 p-0';
/** The file icon's box (`FileIcon` at `md`), and the bar that stands for it while loading. */
const ROW_FILE_ICON_CLASS = 'h-5 w-5';
/** The cells after the name, in both forms. */
const SIZE_CELL_CLASS = 'w-24 shrink-0 pr-4 text-ods-text-secondary text-h6';
const MODIFIED_CELL_CLASS = 'w-36 shrink-0 pl-4 text-ods-text-secondary text-h6';
const ACTIONS_CELL_CLASS = 'flex w-48 shrink-0 items-center justify-end gap-1 pl-4';

export function FileManagerTableRow(props: FileManagerTableRowProps) {
  const {
    file,
    isSelected = false,
    showCheckbox = true,
    showPath = false,
    loading: loadingProp,
    onSelect,
    onClick,
    onDoubleClick,
    onContextMenu,
    onActionClick,
    className,
  } = props;
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  // ONE switch: in a loading scope, while the host reads the folder, or with no file yet, the row is its loading form.
  const loading = useLoadingScope() || !!loadingProp || !file;
  if (loading) {
    return (
      <FileManagerTableRowSkeleton
        showCheckbox={showCheckbox}
        showPath={showPath}
        className={className}
        {...loadingItemProps(props)}
      />
    );
  }

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't trigger row click if clicking on interactive elements
    if ((e.target as HTMLElement).closest('[data-no-row-click]')) {
      return;
    }
    onClick?.();
  };

  const handleCheckboxChange = (checked: boolean) => {
    onSelect?.(checked);
  };

  const handleContextAction = (action: FileAction) => {
    onActionClick?.(action);
    setContextMenuOpen(false);
  };

  const fileExtension = file.type === 'file' ? file.name.split('.').pop() : undefined;

  return (
    <div
      className={cn(
        FILE_MANAGER_ROW_FRAME_CLASS,
        'cursor-pointer transition-colors hover:bg-ods-bg-hover',
        isSelected && 'bg-ods-bg-surface',
        className,
      )}
      onClick={handleRowClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={e => {
        e.preventDefault();
        onContextMenu?.(e);
      }}
      {...loadingItemProps(props)}
    >
      {showCheckbox && (
        <div className="mr-4" data-no-row-click>
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleCheckboxChange}
            boxClassName={FILE_MANAGER_CHECKBOX_BOX_CLASS}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <FileIcon type={file.type} extension={fileExtension} size="md" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-ods-text-primary text-h6" title={file.name}>
            {file.name}
          </span>
          {showPath && file.path && (
            <span className="truncate text-ods-text-secondary text-h6" title={file.path}>
              {file.path}
            </span>
          )}
        </div>
      </div>

      <div className={SIZE_CELL_CLASS}>{file.size || ''}</div>

      <div className={MODIFIED_CELL_CLASS}>{file.modified}</div>

      <div className={ACTIONS_CELL_CLASS} data-no-row-click>
        <FileManagerContextMenu
          open={contextMenuOpen}
          onOpenChange={setContextMenuOpen}
          onAction={handleContextAction}
          fileType={file.type}
          trigger={rowMenuButton()}
        />

        {file.type === 'folder' ? (
          <Button
            variant="transparent"
            size="small-legacy"
            className={ROW_ICON_BUTTON_CLASS}
            onClick={e => {
              e.stopPropagation();
              onDoubleClick?.();
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="w-8" /> /* Space to maintain alignment when no chevron */
        )}
      </div>
    </div>
  );
}

/** The row's "…" menu trigger (shown on hover): the same button in both forms (inert in the loading row). */
function rowMenuButton() {
  return (
    <Button
      variant="transparent"
      size="small-legacy"
      className={cn(ROW_ICON_BUTTON_CLASS, 'opacity-0 transition-opacity group-hover:opacity-100')}
      onClick={e => {
        e.stopPropagation();
      }}
    >
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  );
}

/**
 * The row while its file is read: the row's own frame and cells, the read parts (icon, name, path on a search result,
 * size, date, whether a chevron opens it) as bars, the checkbox its own loading box and the "…" trigger real and
 * inert. Decoration: the file manager's region says it is loading.
 */
function FileManagerTableRowSkeleton({
  showCheckbox,
  showPath,
  className,
  ...markers
}: {
  showCheckbox: boolean;
  showPath: boolean;
  className?: string;
  [marker: `data-${string}`]: unknown;
}) {
  return (
    <div aria-hidden="true" inert className={cn(FILE_MANAGER_ROW_FRAME_CLASS, className)} {...markers}>
      {showCheckbox && (
        <div className="mr-4">
          <Checkbox loading boxClassName={FILE_MANAGER_CHECKBOX_BOX_CLASS} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <UnifiedSkeleton className={cn(ROW_FILE_ICON_CLASS, 'shrink-0 rounded')} />
        <div className="flex min-w-0 flex-col">
          <TextLineSkeleton type="h6" className="w-32" />
          {/* Every search result names its folder: the path line is drawn whenever paths are shown. */}
          {showPath && <TextLineSkeleton type="h6" className="w-48" />}
        </div>
      </div>

      <div className={SIZE_CELL_CLASS}>
        <TextLineSkeleton type="h6" className="w-16" />
      </div>

      <div className={MODIFIED_CELL_CLASS}>
        <TextLineSkeleton type="h6" className="w-24" />
      </div>

      <div className={ACTIONS_CELL_CLASS}>
        {rowMenuButton()}
        <UnifiedSkeleton className={cn(ROW_ICON_BUTTON_CLASS, 'rounded')} />
      </div>
    </div>
  );
}
