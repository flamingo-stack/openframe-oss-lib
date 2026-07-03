'use client'

import React from 'react'
import { MingoIcon } from '../icons'
import { cn } from '../../utils'

export interface MingoAiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  source?: string
}

export function MingoAiButton({ source, className, onClick, ...props }: MingoAiButtonProps) {
  return (
    <button
      {...props}
      type="button"
      aria-label="Mingo AI"
      onClick={(e) => {
        window.dispatchEvent(new CustomEvent('ask-ai:open', { detail: { source } }))
        onClick?.(e)
      }}
      className={cn(
        'relative -my-3 flex h-[72px] items-center gap-[var(--spacing-system-s)] overflow-hidden border-l border-ods-border bg-ods-bg px-[var(--spacing-system-lf)] transition-colors duration-200 hover:bg-ods-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-4 -right-20 h-8 w-40 rounded-full blur-2xl"
        style={{ background: 'var(--ods-flamingo-cyan-base)' }}
      />
      <MingoIcon
        color="currentColor"
        eyesColor="var(--ods-flamingo-cyan-base)"
        cornerColor="var(--ods-flamingo-cyan-base)"
        className="relative h-6 w-6 shrink-0 text-ods-text-primary"
      />
      <span className="relative hidden whitespace-nowrap text-h3 font-bold tracking-[-0.36px] text-ods-text-primary md:inline">
        Mingo AI
      </span>
    </button>
  )
}

export default MingoAiButton
