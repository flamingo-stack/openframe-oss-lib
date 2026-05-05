'use client'

import React from 'react'
import { cn } from '../../utils/cn'
import { Chevron02LeftIcon } from '../icons-v2-generated/arrows/chevron-02-left-icon'

export interface BackButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
}

export function BackButton({ label = 'Back', className, type = 'button', ...props }: BackButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'group inline-flex items-center justify-center self-start rounded-md',
        'gap-[var(--spacing-system-xsf)] py-[var(--spacing-system-sf)]',
        'text-ods-text-secondary hover:text-ods-text-primary',
        'transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus',
        className,
      )}
      {...props}
    >
      <Chevron02LeftIcon className="size-6 shrink-0" />
      <span className="text-h3">{label}</span>
    </button>
  )
}

export default BackButton
