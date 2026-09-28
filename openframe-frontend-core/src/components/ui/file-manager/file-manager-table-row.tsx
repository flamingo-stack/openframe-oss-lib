'use client';

import { ChevronRight, MoreHorizontal } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { cn } from '../../../utils/cn';
import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { FileIcon } from './file-icon';
import { FileManagerContextMenu } from './file-manager-context-menu';
import type { FileAction, FileManagerTableRowProps } from './types';

export function FileManagerTableRow({
  file,
  isSelected = false,
  showCheckbox = true,
  showPath = false,
  onSelect,
  onClick,
  onDoubleClick,
  onContextMenu,
  onActionClick,
  className,
}: FileManagerTableRowProps) {
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

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
        'group flex h-16 items-center border-ods-border bg-ods-card px-4',
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
    >
      {showCheckbox && (
        <div className="mr-4" data-no-row-click>
          <Checkbox checked={isSelected} onCheckedChange={handleCheckboxChange} className="h-5 w-5" />
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

      <div className="w-24 shrink-0 pr-4 text-ods-text-secondary text-h6">{file.size || ''}</div>

      <div className="w-36 shrink-0 pl-4 text-ods-text-secondary text-h6">{file.modified}</div>

      <div className="flex w-48 shrink-0 items-center justify-end gap-1 pl-4" data-no-row-click>
        <FileManagerContextMenu
          open={contextMenuOpen}
          onOpenChange={setContextMenuOpen}
          onAction={handleContextAction}
          fileType={file.type}
          trigger={
            <Button
              variant="transparent"
              size="small-legacy"
              className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={e => {
                e.stopPropagation();
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          }
        />

        {file.type === 'folder' ? (
          <Button
            variant="transparent"
            size="small-legacy"
            className="h-8 w-8 p-0"
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
