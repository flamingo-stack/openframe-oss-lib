'use client';

import { FolderOpen } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { Button } from '../button';
import type { FileManagerEmptyProps } from './types';

export function FileManagerEmpty({
  message = 'No files or folders found',
  description = 'This folder is empty. Create a new folder or upload files to get started.',
  action,
  className,
}: FileManagerEmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-4 py-20', className)}>
      <div className="mb-6 rounded-full bg-ods-bg-surface p-4">
        <FolderOpen className="h-12 w-12 text-ods-text-tertiary" />
      </div>

      <h3 className="mb-2 text-ods-text-primary text-h4">{message}</h3>

      <p className="mb-6 max-w-md text-center text-ods-text-secondary text-h6">{description}</p>

      {action && (
        <Button variant="accent" size="small-legacy" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
