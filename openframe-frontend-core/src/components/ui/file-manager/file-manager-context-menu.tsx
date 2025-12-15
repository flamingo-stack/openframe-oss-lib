'use client'

import React from 'react'
import { Download, Copy, Edit2, Scissors, Archive, Trash2, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../dropdown-menu'
import { Button } from '../button'
import { cn } from '../../../utils/cn'
import type { FileManagerContextMenuProps } from './types'

export function FileManagerContextMenu({ 
  open,
  onOpenChange,
  onAction,
  fileType = 'file',
  hasSelection = false,
  trigger,
  className 
}: FileManagerContextMenuProps) {
  const menuItems = [
    {
      action: 'download' as const,
      label: 'Download',
      icon: Download,
      show: fileType === 'file' || hasSelection
    },
    {
      action: 'copy' as const,
      label: 'Copy',
      icon: Copy,
      show: true
    },
    {
      action: 'rename' as const,
      label: 'Rename',
      icon: Edit2,
      show: !hasSelection
    },
    {
      action: 'cut' as const,
      label: 'Cut',
      icon: Scissors,
      show: true
    },
    {
      action: 'delete' as const,
      label: 'Delete',
      icon: Trash2,
      show: true,
      separator: true
    }
  ]

  const visibleItems = menuItems.filter(item => item.show)

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className={cn('w-56', className)}
        onClick={(e) => e.stopPropagation()}
      >
        {visibleItems.map((item, index) => (
          <React.Fragment key={item.action}>
            {item.separator && index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onAction(item.action)
              }}
              className="cursor-pointer"
            >
              <item.icon className="mr-3 h-4 w-4" />
              <span>{item.label}</span>
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}