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
    <div className={cn('flex items-center gap-4 flex-wrap md:justify-end', className)}>
      <Button
        variant="outline"
        size="small-legacy"
        onClick={onNewFolder}
        leftIcon={<FolderPlus className="h-4 w-4" />}
      >
        New Folder
      </Button>

      <Button
        variant="outline"
        size="small-legacy"
        onClick={onCopy}
        disabled={!hasSelection}
        leftIcon={<Copy className="h-4 w-4" />}
      >
        Copy
      </Button>

      <Button
        variant="outline"
        size="small-legacy"
        onClick={onCut}
        disabled={!hasSelection}
        leftIcon={<Scissors className="h-4 w-4" />}
      >
        Cut
      </Button>

      <Button
        variant="outline"
        size="small-legacy"
        onClick={onPaste}
        disabled={!canPaste}
        leftIcon={<Clipboard className="h-4 w-4" />}
      >
        Paste
      </Button>

      <Button
        variant="outline"
        size="small-legacy"
        onClick={onUpload}
        leftIcon={<Upload className="h-4 w-4" />}
      >
        Upload
      </Button>

      <Button
        variant="outline"
        size="small-legacy"
        onClick={onSelectAll}
        leftIcon={<CheckSquare className="h-4 w-4" />}
      >
        Select All
      </Button>
    </div>
  )
}