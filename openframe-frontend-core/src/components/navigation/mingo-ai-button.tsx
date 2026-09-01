'use client';

import type React from 'react';
import { cn } from '../../utils';
import { MingoIcon } from '../icons';

export interface MingoAiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  source?: string;
  /** The platform's Mingo identity glyph — pass the SAME server-configured
   *  icon the chat panel renders (host-side: `EntityIcon` fed by the admin
   *  `assistantIcon`), so the launcher and the panel can never diverge.
   *  Falls back to the packaged Mingo mark when the server has none. */
  icon?: React.ReactNode;
  /** The launcher's wordmark + aria-label — pass the server-configured
   *  assistant name (same `assistantName` the chat panel shows) so the
   *  launcher never hardcodes an identity the admin has renamed. */
  label?: string;
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
const MINGO_ACCENT = 'var(--ods-flamingo-cyan-base)';

export function MingoAiButton({ source, icon, label = 'Mingo AI', className, onClick, ...props }: MingoAiButtonProps) {
  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      onClick={e => {
        // Coalesce to '' so a source-less mount still matches EmbeddableChat's
        // own `runtime.source ?? ''` comparison (undefined !== '' would make
        // the panel silently ignore the event).
        window.dispatchEvent(new CustomEvent('ask-ai:open', { detail: { source: source ?? '' } }));
        onClick?.(e);
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
      {/* Inner box = 1:1 twin of the DEFAULT-size Button geometry (rounded-md,
          h-11 md:h-12, px-m) — the same footprint as the header's "Try for
          Free" CTA — so the animated ring traces exactly where a full button
          border would sit inside the 72px bar. */}
      <span className="relative flex h-11 items-center gap-[var(--spacing-system-xsf)] rounded-md px-[var(--spacing-system-m)] md:h-12">
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
            spec. h3 bold, matching the default-size CTA label next to it
            (Figma 2936-6825). */}
        {/* Bare `text-h3` — the exact composite the default-size Button label
            uses (bold 700 and -0.02em tracking are built into the utility). */}
        <span className="relative hidden whitespace-nowrap text-ods-text-primary text-h3 md:inline">{label}</span>
      </span>
    </button>
  );
}

export default MingoAiButton;
