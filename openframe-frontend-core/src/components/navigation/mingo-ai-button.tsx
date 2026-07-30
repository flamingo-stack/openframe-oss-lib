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
 * full-height flush cell layout, an absolutely-positioned animated ring, and
 * icon-only collapse that `Button` cannot express (same precedent as
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
        // Unified ODS top-navigation cell (Figma 2797-6808 desktop /
        // 2797-7275 mobile): full-height cell with a leading divider,
        // transparent at rest so it inherits the bar's background.
        // No hover background on the cell: the animated ring + shimmer are
        // the ONLY hover treatment (a bg flip on top read as a double
        // animation).
        'group/mingo relative flex h-full shrink-0 items-center border-l border-ods-border bg-transparent px-[var(--spacing-system-m)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent',
        className,
      )}
    >
      {/* Inner box = 1:1 twin of the header CTA's `size="small"` Button
          geometry (rounded-md, h-6 md:h-8) so the animated ring traces
          exactly where a normal small-button border would sit inside the
          48/56px cell. */}
      <span className="relative flex h-6 items-center gap-[var(--spacing-system-xsf)] rounded-md px-[var(--spacing-system-xsf)] md:h-8">
        {/* AI edge light (Apple-Intelligence-style): a rotating accent-
            gradient arc clipped to a 3px ring on the box outline via CSS
            mask (.mingo-edge-frame) — NO opaque cover, so the launcher
            inherits whatever background sits behind it. Platform-tinted via
            the accent token. */}
        <span aria-hidden="true" className="mingo-edge-frame pointer-events-none absolute inset-0 rounded-md">
          <span className="mingo-edge" />
        </span>
        {/* One-shot light-streak shimmer on hover, clipped to the box. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
          <span
            className="mingo-shimmer absolute inset-y-0 left-0 w-1/2"
            style={{
              background:
                'linear-gradient(105deg, transparent, color-mix(in srgb, var(--ods-system-greys-white) 12%, transparent), transparent)',
            }}
          />
        </span>
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
        {/* Wordmark collapses below md — the mobile cell is icon-only per
            spec. `text-code` (sentence-case mono caption, matching the small
            CTA next to it) by product decision — the Figma wordmark is h3
            bold; flagged for the designer. */}
        <span className="relative hidden whitespace-nowrap text-code text-ods-text-primary md:inline">{label}</span>
      </span>
    </button>
  )
}

export default MingoAiButton
