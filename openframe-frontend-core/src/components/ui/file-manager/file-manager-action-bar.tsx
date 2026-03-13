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
        size="sm"
        onClick={onNewFolder}
        leftIcon={<FolderPlus className="h-4 w-4" />}
        fullWidthOnMobile={false}
      >
        New Folder
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onCopy}
        disabled={!hasSelection}
        leftIcon={<Copy className="h-4 w-4" />}
        fullWidthOnMobile={false}
      >
        Copy
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onCut}
        disabled={!hasSelection}
        leftIcon={<Scissors className="h-4 w-4" />}
        fullWidthOnMobile={false}
      >
        Cut
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onPaste}
        disabled={!canPaste}
        leftIcon={<Clipboard className="h-4 w-4" />}
        fullWidthOnMobile={false}
      >
        Paste
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onUpload}
        leftIcon={<Upload className="h-4 w-4" />}
        fullWidthOnMobile={false}
      >
        Upload
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onSelectAll}
        leftIcon={<CheckSquare className="h-4 w-4" />}
        fullWidthOnMobile={false}
      >
        Select All
      </Button>
    </div>
  )
}