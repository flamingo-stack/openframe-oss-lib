import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface StripCardProps {
  /** Before the title, at 24px (an icon, a step's number). */
  lead?: ReactNode;
  title: ReactNode;
  /** One quieter line under the title. */
  caption?: ReactNode;
  /** The title's element. Default `h3`. */
  titleAs?: 'h3' | 'h4' | 'p';
  /** `roomy` gives the head and the body the larger inset (a card whose head carries a caption). */
  density?: 'default' | 'roomy';
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * THE card with a head strip (Figma "Info-card" with a `tag` head): a head on
 * the card surface holding a mark, a title and an optional caption, a hairline,
 * then the body on the page surface. One frame for every such card, so a row
 * of them shares its radius, hairlines and insets.
 */
export function StripCard({
  lead,
  title,
  caption,
  titleAs: Title = 'h3',
  density = 'default',
  children,
  className,
  bodyClassName,
}: StripCardProps) {
  const roomy = density === 'roomy';
  return (
    <div
      className={cn(
        'flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-ods-border bg-ods-card',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center gap-[var(--spacing-system-mf)] border-b border-ods-border',
          roomy ? 'p-[var(--spacing-system-l)]' : 'p-[var(--spacing-system-m)]',
        )}
      >
        {lead && <span className="flex shrink-0 items-center">{lead}</span>}
        <div className="flex min-w-0 flex-1 flex-col">
          <Title className="m-0 text-ods-text-primary text-h3">{title}</Title>
          {caption && <span className="text-ods-text-secondary text-h6">{caption}</span>}
        </div>
      </div>
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col bg-ods-bg',
          roomy
            ? 'gap-[var(--spacing-system-l)] p-[var(--spacing-system-l)]'
            : 'gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] pb-[var(--spacing-system-l)] pt-[var(--spacing-system-m)]',
          bodyClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
