'use client'

import React from 'react'
import { MingoIcon } from '../icons'
import { cn } from '../../utils'

export interface MingoAiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  source?: string
}

/**
 * Marketing-header Mingo AI launcher: the flush, full-height button rendered
 * at the far right edge of the public `Header` (`config.mingo`). Stateless:
 * clicking dispatches an `ask-ai:open` CustomEvent (source-filtered) that the
 * mounted `EmbeddableChat` panel listens for.
 *
 * Distinct from `header-mingo-button.tsx` (`HeaderMingoButton`), the
 * dashboard/AppHeader controlled toggle; different surface and contract, do
 * not merge them.
 *
 * Deliberately a raw `<button>` rather than the ui-kit `Button`: it needs
 * full-height flush layout, an absolutely-positioned glow child, and icon-only
 * collapse that `Button` cannot express (same precedent as
 * `header-mingo-button.tsx`).
 */
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
        // px: 16px below md (icon-only, Figma 3924-35639 mobile), 24px at md+
        // (Figma 4033-90260 desktop) — the compact mobile padding keeps the
        // 375px header row (logo + CTA + burger + Mingo) inside one viewport.
        'relative flex h-full items-center gap-[var(--spacing-system-s)] overflow-hidden border-l border-ods-border bg-ods-card px-[var(--spacing-system-l)] md:px-[var(--spacing-system-lf)] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 h-8 w-40 rounded-full blur-2xl animate-mingo-glow"
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
