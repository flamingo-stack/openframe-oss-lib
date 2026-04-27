'use client'

import type { ReactNode } from 'react'
import { FileX2 } from 'lucide-react'
import { cn } from '../../../utils/cn'
import { Button } from '../button'

export interface DataTableEmptyProps {
  message?: string
  icon?: ReactNode
  action?: { label: string; onClick: () => void }
  className?: string
}

export function DataTableEmpty({
  message = 'No data available',
  icon,
  action,
  className,
}: DataTableEmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-[var(--spacing-system-xxl)] px-[var(--spacing-system-mf)] rounded-md bg-ods-card border border-ods-border',
        className,
      )}
    >
      <div className="mb-[var(--spacing-system-mf)] text-ods-text-secondary">
        {icon ?? <FileX2 className="w-12 h-12" />}
      </div>
      <p className="text-h4 text-ods-text-secondary text-center mb-[var(--spacing-system-lf)]">{message}</p>
      {action && (
        <Button
          variant="outline"
          onClick={action.onClick}
          className="bg-ods-card border-ods-border hover:bg-ods-bg-active text-ods-text-primary"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
