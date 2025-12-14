'use client'

import React from 'react'
import { FolderOpen } from 'lucide-react'
import { Button } from '../button'
import { cn } from '../../../utils/cn'
import type { FileManagerEmptyProps } from './types'

export function FileManagerEmpty({ 
  message = 'No files or folders found',
  description = 'This folder is empty. Create a new folder or upload files to get started.',
  action,
  className 
}: FileManagerEmptyProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-20 px-4',
      className
    )}>
      <div className="p-4 bg-ods-bg-secondary rounded-full mb-6">
        <FolderOpen className="h-12 w-12 text-ods-text-tertiary" />
      </div>
      
      <h3 className="text-lg font-medium text-ods-text-primary mb-2">
        {message}
      </h3>
      
      <p className="text-sm text-ods-text-secondary text-center max-w-md mb-6">
        {description}
      </p>
      
      {action && (
        <Button
          variant="primary"
          size="sm"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}