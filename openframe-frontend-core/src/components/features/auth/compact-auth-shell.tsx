'use client';

import type { ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { OpenFrameWordmark, PoweredByFlamingo } from './auth-branding';

export interface CompactAuthShellProps {
  /** The card, e.g. `LoginForm`. */
  children: ReactNode;
  /** Centered line(s) under the wordmark. */
  tagline?: ReactNode;
  className?: string;
}

/**
 * Single-column auth layout with no tabs and no marketing panel: wordmark and tagline on top, the
 * card directly under them, "Powered by Flamingo" pinned to the bottom of the screen. Unlike
 * `SsoAuthShell` the card is top-aligned, so it stays put while its own height changes (discovery
 * results appearing under the email field).
 *
 * The root carries `of-auth-shell`, the same hook as `AuthShell`, so a host that pads auth roots by
 * the safe-area insets pads this one too. The design padding sits on an inner column for that
 * reason: a host rule on the root would otherwise replace it.
 */
export function CompactAuthShell({
  children,
  tagline = (
    <>
      <span className="block">All your MSP ops in one place.</span>
      <span className="block">Open-source, AI-ready, no vendor tax.</span>
    </>
  ),
  className,
}: CompactAuthShellProps) {
  return (
    <div className={cn('of-auth-shell flex min-h-screen w-full flex-col bg-ods-bg', className)}>
      <div className="flex w-full flex-1 flex-col items-center gap-[var(--spacing-system-l)] p-[var(--spacing-system-l)]">
        <OpenFrameWordmark />
        {tagline && <p className="text-center text-ods-text-primary text-h4">{tagline}</p>}
        <div className="w-full max-w-[600px]">{children}</div>
        <div className="mt-auto">
          <PoweredByFlamingo compact />
        </div>
      </div>
    </div>
  );
}
