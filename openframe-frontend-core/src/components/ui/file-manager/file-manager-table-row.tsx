'use client'

import React, { useState } from 'react'
import { ChevronRight, MoreHorizontal } from 'lucide-react'
import { Checkbox } from '../checkbox'
import { Button } from '../button'
import { cn } from '../../../utils/cn'
import { FileIcon } from './file-icon'
import { FileManagerContextMenu } from './file-manager-context-menu'
import type { FileManagerTableRowProps } from './types'

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
  className 
}: FileManagerTableRowProps) {
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  
  const handleRowClick = (e: React.MouseEvent) => {
    // Don't trigger row click if clicking on interactive elements
    if ((e.target as HTMLElement).closest('[data-no-row-click]')) {
      return
    }
    onClick?.()
  }

  const handleCheckboxChange = (checked: boolean) => {
    onSelect?.(checked)
  }

  const handleContextAction = (action: any) => {
    onActionClick?.(action)
    setContextMenuOpen(false)
  }

  const fileExtension = file.type === 'file' 
    ? file.name.split('.').pop() 
    : undefined

  return (
    <div
      className={cn(
        'bg-ods-card group flex items-center h-16 px-4 border-ods-border',
        'hover:bg-ods-bg-secondary transition-colors cursor-pointer',
        isSelected && 'bg-ods-bg-secondary',
        className
      )}
      onClick={handleRowClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu?.(e)
      }}
    >
      {showCheckbox && (
        <div className="mr-4" data-no-row-click>
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleCheckboxChange}
            className="h-5 w-5"
          />
        </div>
      )}
      
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <FileIcon 
          type={file.type} 
          extension={fileExtension}
          size="md" 
        />
        <div className="flex flex-col min-w-0">
          <span className="text-sm text-ods-text-primary truncate">
            {file.name}
          </span>
          {showPath && file.path && (
            <span className="text-xs text-ods-text-secondary truncate">
              {file.path}
            </span>
          )}
        </div>
      </div>
      
      <div className="w-24 shrink-0 pr-4 text-sm text-ods-text-secondary">
        {file.size || ''}
      </div>
      
      <div className="w-36 shrink-0 pl-4 text-sm text-ods-text-secondary">
        {file.modified}
      </div>
      
      <div className="w-48 shrink-0 pl-4 flex items-center justify-end gap-1" data-no-row-click>
        <FileManagerContextMenu
          open={contextMenuOpen}
          onOpenChange={setContextMenuOpen}
          onAction={handleContextAction}
          fileType={file.type}
          trigger={
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          }
        />
        
        {file.type === 'folder' ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation()
              onDoubleClick?.()
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="w-8" /> /* Space to maintain alignment when no chevron */
        )}
      </div>
    </div>
  )
}