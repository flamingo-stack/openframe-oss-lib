'use client';

import type React from 'react';
import { useVisitorOs } from '../../hooks/ui/use-visitor-os';
import { cn } from '../../utils';
import { shortcutLabel } from '../../utils/visitor-os';
import { MingoIcon } from '../icons';

export interface MingoAiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  source?: string;
  /** The platform's Mingo identity glyph: pass the SAME server-configured
   *  icon the chat panel renders (host-side: `EntityIcon` fed by the admin
   *  `assistantIcon`), so the launcher and the panel can never diverge.
   *  Falls back to the packaged Mingo mark when the server has none. */
  icon?: React.ReactNode;
  /** The launcher's wordmark + aria-label: pass the server-configured
   *  assistant name (same `assistantName` the chat panel shows) so the
   *  launcher never hardcodes an identity the admin has renamed. */
  label?: string;
  /** Show the keyboard hint (Cmd K on Apple platforms, Ctrl K elsewhere) beside
   *  the label. The HOST binds the shortcut; this only shows it. Default false. */
  shortcutHint?: boolean;
  /** `inline` (default): the header launcher, the height and type of the menu
   *  items beside it. `field`: the full-width row that opens the mobile menu
   *  (the name reads as the field's prompt). ONE component, so every Mingo
   *  launcher carries the same identity, ring and event. */
  variant?: 'inline' | 'field';
}

const MINGO_ACCENT = 'var(--ods-flamingo-cyan-base)';

/**
 * THE Mingo AI launcher, in the site header's right cluster and at the top of
 * the mobile menu (`variant="field"`): the round identity glyph, the
 * assistant's name and an optional shortcut hint, sized like the menu items
 * beside it. Stateless: clicking dispatches an `ask-ai:open`
 * CustomEvent (source-filtered) that the mounted `EmbeddableChat` panel
 * listens for.
 *
 * It carries the AI edge light (`.mingo-edge-frame` / `.mingo-edge` in
 * `styles/chat-animations.css`): an accent arc travelling around its outline,
 * with a one-shot shimmer on hover. Static under reduced motion.
 *
 * Distinct from `header-mingo-button.tsx` (`HeaderMingoButton`), the
 * dashboard/AppHeader controlled toggle; different surface and contract, do
 * not merge them.
 *
 * Deliberately a raw `<button>` rather than the ui-kit `Button`: it needs an
 * absolutely-positioned animated ring and an icon-only collapse that `Button`
 * cannot express (same precedent as `header-mingo-button.tsx`).
 */
export function MingoAiButton({
  source,
  icon,
  label = 'Mingo AI',
  shortcutHint = false,
  variant = 'inline',
  className,
  onClick,
  ...props
}: MingoAiButtonProps) {
  // Known after hydration only: until then the hint keeps its space, empty.
  const visitor = useVisitorOs();
  const field = variant === 'field';

  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      aria-keyshortcuts={shortcutHint ? 'Meta+K Control+K' : undefined}
      onClick={e => {
        // Coalesce to '' so a source-less mount still matches EmbeddableChat's
        // own `runtime.source ?? ''` comparison (undefined !== '' would make
        // the panel silently ignore the event).
        window.dispatchEvent(new CustomEvent('ask-ai:open', { detail: { source: source ?? '' } }));
        onClick?.(e);
      }}
      className={cn(
        // Transparent at rest so it inherits the bar's background; the hover
        // wash is the menu items' own.
        'group/mingo relative flex shrink-0 items-center gap-[var(--spacing-system-xsf)] rounded-md text-ods-text-secondary transition-colors hover:bg-ods-bg-hover hover:text-ods-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent',
        field
          ? 'h-[52px] w-full bg-ods-card px-[var(--spacing-system-sf)] text-left'
          : 'h-10 pl-[var(--spacing-system-xsf)] pr-2.5',
        className,
      )}
    >
      {/* AI edge light (Apple-Intelligence-style): a rotating accent-gradient
          arc clipped to a hairline ring on the outline via CSS mask
          (.mingo-edge-frame). NO opaque cover, so the launcher inherits
          whatever background sits behind it. Platform-tinted via the accent
          token. */}
      <span aria-hidden="true" className="mingo-edge-frame pointer-events-none absolute inset-0 rounded-md">
        <span className="mingo-edge" />
      </span>
      {/* One-shot light-streak shimmer on hover, clipped to the outline. */}
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
        <span
          className={cn(
            'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
            field ? 'size-6' : 'size-5',
          )}
        >
          {icon}
        </span>
      ) : (
        <MingoIcon
          color="currentColor"
          eyesColor={MINGO_ACCENT}
          cornerColor={MINGO_ACCENT}
          className={cn('relative shrink-0 text-ods-text-primary', field ? 'size-6' : 'size-5')}
        />
      )}
      {/* In the header the name collapses below lg, with the menus: on a phone
          the launcher is its glyph alone (the name stays the accessible name). */}
      <span
        className={cn(
          'relative whitespace-nowrap',
          field ? 'min-w-0 flex-1 truncate text-ods-text-muted text-h4' : 'hidden text-h6 lg:inline',
        )}
      >
        {label}
      </span>
      {shortcutHint && !field && (
        // A key cap in the label's own type (never smaller: a hint nobody can
        // read is decoration) and the label's colour, which clears 4.5:1 on
        // the bar. It keeps its width before the platform is known.
        <kbd className="relative hidden h-6 min-w-9 items-center justify-center rounded border border-ods-border px-[var(--spacing-system-xxs)] text-h6 lg:inline-flex">
          {visitor.known ? shortcutLabel(visitor.os, 'K') : ''}
        </kbd>
      )}
    </button>
  );
}

export default MingoAiButton;
