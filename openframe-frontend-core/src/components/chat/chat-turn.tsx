import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface ChatTurnProps {
  /** Rendered as given, at the size the caller draws it (a person's picture, an agent's mark). */
  avatar?: ReactNode;
  name: string;
  /** A quieter word after the name ("on her laptop"). */
  meta?: string;
  /** `quiet` steps the name back to the caption size and colour (a turn inside a denser card). */
  nameSize?: 'default' | 'quiet';
  /** Shown as given, at the far end of the name row ("2:47 PM"). */
  time?: string | null;
  /** What was said. A string is drawn as the message text; a node is drawn as given. */
  children?: ReactNode;
  className?: string;
}

/**
 * THE turn of a scripted conversation (an example card, a step of a demo): the
 * speaker's picture, then beside it their name, the time at the far end, and
 * what was said under them. Names read as they do everywhere else: the body
 * face, the text colour.
 */
export function ChatTurn({ avatar, name, meta, nameSize = 'default', time, children, className }: ChatTurnProps) {
  return (
    <div className={cn('flex min-w-0 items-start gap-[var(--spacing-system-sf)]', className)}>
      {avatar && <span className="shrink-0">{avatar}</span>}
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xxs)]">
        <div className="flex min-w-0 items-baseline gap-[var(--spacing-system-xsf)]">
          <span className="flex min-w-0 flex-1 items-baseline gap-[var(--spacing-system-xsf)]">
            <span
              className={cn(
                'min-w-0 truncate',
                nameSize === 'quiet' ? 'text-ods-text-secondary text-h6' : 'text-ods-text-primary text-h4',
              )}
            >
              {name}
            </span>
            {meta && <span className="min-w-0 truncate text-ods-text-secondary text-h6">{meta}</span>}
          </span>
          {time && <span className="shrink-0 text-ods-text-secondary text-h6">{time}</span>}
        </div>
        {typeof children === 'string' ? (
          <p className="m-0 whitespace-pre-wrap text-ods-text-primary text-h4">{children}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
