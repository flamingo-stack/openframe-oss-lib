'use client';

import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { useAgentTint } from '../agent-identity';

export interface AppWindowFrameProps {
  /** Centered in the title bar; a long one wraps and the bar grows, never ends in "…". */
  title?: string;
  children: ReactNode;
  /** A bar pinned under the body (a status line, an action). */
  footer?: ReactNode;
  /**
   * The slug of the agent whose window this is. The window takes that agent's
   * tint from its identity, like every card of the agent's. A window names its
   * agent, never a colour.
   */
  agent?: string | null;
  className?: string;
  /** The scrolling body between the title bar and the footer. */
  bodyClassName?: string;
}

/**
 * A desktop app window: title bar with three window dots and a centered
 * title, a body, an optional footer bar. Decorative chrome for showing a
 * product surface on a marketing page; the dots are not controls.
 *
 * The frame is a column, so give it a height and the body fills what is left.
 */
/** The window's three dots (decorative: not controls). */
function WindowDots({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span className="h-2.5 w-2.5 rounded-full bg-ods-border" />
      <span className="h-2.5 w-2.5 rounded-full bg-ods-border" />
      <span className="h-2.5 w-2.5 rounded-full bg-ods-border" />
    </span>
  );
}

export function AppWindowFrame({ title, children, footer, agent, className, bodyClassName }: AppWindowFrameProps) {
  const tint = useAgentTint(agent);
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-xl border border-ods-border',
        // An agent's window sits on the page surface under that agent's tint.
        tint ? 'bg-ods-bg' : 'bg-ods-card',
        className,
      )}
      style={tint}
    >
      {/* The dots, the title, and the dots' width again (unseen) on the right, so the title stays centred on the bar. */}
      <div
        className="grid min-h-10 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[var(--spacing-system-xsf)] border-b border-ods-border px-4 py-[var(--spacing-system-xsf)]"
        aria-hidden
      >
        <WindowDots />
        {title ? (
          <span className="pointer-events-none text-balance text-center text-ods-text-secondary text-h6 [overflow-wrap:anywhere]">
            {title}
          </span>
        ) : (
          <span />
        )}
        <WindowDots className="invisible" />
      </div>
      <div className={cn('flex min-h-0 flex-1 flex-col', bodyClassName)}>{children}</div>
      {footer && <div className="shrink-0 border-t border-ods-border bg-ods-bg">{footer}</div>}
    </div>
  );
}
