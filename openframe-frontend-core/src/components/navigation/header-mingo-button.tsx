'use client';

import type React from 'react';
import { cn } from '../../utils/cn';
import { AgentMark } from '../agent-mark';
import { XmarkIcon } from '../icons-v2-generated';
import { Button } from '../ui/button';

export interface HeaderMingoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Active/pressed state — set to `true` while the Mingo drawer is open. */
  isActive?: boolean;
  /** When true, hides the "Mingo AI" label and renders only the icon (so the
   *  control collapses to a square `HeaderButton`-sized affordance on narrow
   *  viewports). Defaults to `false`. */
  iconOnly?: boolean;
  /** Show the close "X" while active with the wordmark too, not only in
   *  `iconOnly` mode. Defaults to `false`. */
  closeWhenActive?: boolean;
  className?: string;
}

/**
 * "Mingo AI" launcher button for `AppHeader`. Mirrors the `HeaderButton`
 * visual contract (sticky header height, `ods-card` rest / `ods-bg-hover`
 * hover, divider via `AppHeader`'s `divide-x`), but carries both the Mingo
 * logo and the bold "Mingo AI" wordmark. The open/active state is exposed via
 * `aria-pressed` (and, in `iconOnly` mode, by swapping the logo for a close
 * "X"); there is no distinct active background.
 *
 * Figma: 7532:222103 — `button-full`.
 */
export function HeaderMingoButton({
  isActive = false,
  iconOnly = false,
  closeWhenActive = false,
  className,
  ...props
}: HeaderMingoButtonProps) {
  const showClose = isActive && (iconOnly || closeWhenActive);
  return (
    <Button
      variant="cell"
      type="button"
      aria-label={showClose ? 'Close Mingo AI' : 'Mingo AI'}
      aria-pressed={isActive}
      className={cn(
        // `iconOnly` (below md): a square cell, the bar's `--top-nav-cell` like every
        // other one (`HeaderButton`), so its divider lines up with what sits under the
        // bar. Otherwise the fixed 140px cell from md, so the header's right-hand
        // cluster has a known width and a loading placeholder can reserve it exactly
        // (`AppHeaderProps.loadingActionCells` → `'wide'`).
        iconOnly ? 'w-[var(--top-nav-cell,3.5rem)]' : 'md:w-[140px]',
        className,
      )}
      {...props}
    >
      {showClose ? (
        // Mobile, drawer open: the icon-only button doubles as the close
        // affordance, so swap the Mingo logo for an X. Match the other header
        // icons (e.g. notifications): secondary color, w-4 h-4 → md:w-6 h-6.
        <XmarkIcon className="h-6 w-6 shrink-0 text-ods-text-secondary" />
      ) : (
        // Outer frame follows the button's text color (currentColor); the eyes
        // and corner block are ODS cyan.
        <AgentMark agent="mingo" className="h-6 w-6 shrink-0" />
      )}
      {!iconOnly && <span className="whitespace-nowrap font-bold tracking-[-0.36px] text-h3">Mingo AI</span>}
    </Button>
  );
}

export default HeaderMingoButton;
