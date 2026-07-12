'use client'

import React from 'react'
import { MingoIcon } from '../icons'
import { cn } from '../../utils'

export interface MingoAiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  source?: string
  /** The platform's Mingo identity glyph — pass the SAME server-configured
   *  icon the chat panel renders (host-side: `EntityIcon` fed by the admin
   *  `assistantIcon`), so the launcher and the panel can never diverge.
   *  Falls back to the packaged Mingo mark when the server has none. */
  icon?: React.ReactNode
  /** The launcher's wordmark + aria-label — pass the server-configured
   *  assistant name (same `assistantName` the chat panel shows) so the
   *  launcher never hardcodes an identity the admin has renamed. */
  label?: string
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
const MINGO_ACCENT = 'var(--ods-flamingo-cyan-base)'

export function MingoAiButton({ source, icon, label = 'Mingo AI', className, onClick, ...props }: MingoAiButtonProps) {
  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      onClick={(e) => {
        // Coalesce to '' so a source-less mount still matches EmbeddableChat's
        // own `runtime.source ?? ''` comparison (undefined !== '' would make
        // the panel silently ignore the event).
        window.dispatchEvent(new CustomEvent('ask-ai:open', { detail: { source: source ?? '' } }))
        onClick?.(e)
      }}
      className={cn(
        // `--spacing-system-l` is itself responsive (16px, 24px from 800px):
        // the compact mobile padding keeps the 375px header row
        // (logo + CTA + burger + Mingo) inside one viewport per Figma
        // 3924-35639 (mobile) / 4033-90260 (desktop).
        'group/mingo relative flex h-full items-center gap-[var(--spacing-system-s)] overflow-hidden border-l border-ods-border bg-ods-card px-[var(--spacing-system-l)] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent',
        className,
      )}
    >
      {/* AI edge light (Apple-Intelligence-style): a rotating accent-gradient
          arc shown only through the 2px border reveal below — platform-tinted
          via the accent token. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="mingo-edge" />
      </span>
      {/* Interior cover: reveals the rotating gradient ONLY as a thin edge.
          Must match the button surface (bg-ods-card). */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-[2px] bg-ods-card" />
      {/* One-shot light-streak shimmer on hover (compositor-only sweep). */}
      <span
        aria-hidden="true"
        className="mingo-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/2"
        style={{ background: 'linear-gradient(105deg, transparent, color-mix(in srgb, var(--ods-system-greys-white) 12%, transparent), transparent)' }}
      />
      {icon ? (
        <span className="relative inline-flex size-6 shrink-0 items-center justify-center">{icon}</span>
      ) : (
        <MingoIcon
          color="currentColor"
          eyesColor={MINGO_ACCENT}
          cornerColor={MINGO_ACCENT}
          className="relative h-6 w-6 shrink-0 text-ods-text-primary"
        />
      )}
      <span className="relative hidden whitespace-nowrap text-h3 font-bold tracking-[-0.36px] text-ods-text-primary md:inline">
        {label}
      </span>
    </button>
  )
}

export default MingoAiButton
