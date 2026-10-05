import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface AppWindowFrameProps {
  /** Centered in the title bar. */
  title?: string;
  children: ReactNode;
  /** A bar pinned under the body (a status line, an action). */
  footer?: ReactNode;
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
export function AppWindowFrame({ title, children, footer, className, bodyClassName }: AppWindowFrameProps) {
  return (
    <div
      className={cn('flex min-w-0 flex-col overflow-hidden rounded-xl border border-ods-border bg-ods-card', className)}
    >
      <div className="relative flex h-10 shrink-0 items-center gap-2 border-b border-ods-border px-4" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-ods-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-ods-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-ods-border" />
        {title && (
          <span className="pointer-events-none absolute inset-x-0 truncate px-20 text-center text-ods-text-secondary text-h6">
            {title}
          </span>
        )}
      </div>
      <div className={cn('flex min-h-0 flex-1 flex-col', bodyClassName)}>{children}</div>
      {footer && <div className="shrink-0 border-t border-ods-border bg-ods-bg">{footer}</div>}
    </div>
  );
}
