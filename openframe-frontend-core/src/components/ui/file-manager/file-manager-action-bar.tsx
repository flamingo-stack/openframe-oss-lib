'use client'

import React from 'react'
import { FolderPlus, Clipboard, Upload, CheckSquare, Copy, Scissors } from 'lucide-react'
import { Button } from '../button'
import { cn } from '../../../utils/cn'
import type { FileManagerActionBarProps } from './types'

export function FileManagerActionBar({ 
  canPaste = false,
  hasSelection = false,
  onNewFolder,
  onPaste,
  onCopy,
  onCut,
  onUpload,
  onSelectAll,
  className 
}: FileManagerActionBarProps) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={onNewFolder}
        leftIcon={<FolderPlus className="h-3 w-3" />}
        className="!text-xs !px-2 !py-1 !h-7"
      >
        NEW FOLDER
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onCopy}
        disabled={!hasSelection}
        leftIcon={<Copy className="h-3 w-3" />}
        className="!text-xs !px-2 !py-1 !h-7"
      >
        COPY
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onCut}
        disabled={!hasSelection}
        leftIcon={<Scissors className="h-3 w-3" />}
        className="!text-xs !px-2 !py-1 !h-7"
      >
        CUT
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onPaste}
        disabled={!canPaste}
        leftIcon={<Clipboard className="h-3 w-3" />}
        className="!text-xs !px-2 !py-1 !h-7"
      >
        PASTE
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onUpload}
        leftIcon={<Upload className="h-3 w-3" />}
        className="!text-xs !px-2 !py-1 !h-7"
      >
        UPLOAD
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onSelectAll}
        leftIcon={<CheckSquare className="h-3 w-3" />}
        className="!text-xs !px-2 !py-1 !h-7"
      >
        SELECT ALL
      </Button>
    </div>
  )
}