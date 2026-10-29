'use client';

import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from './loading-scope';

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

/** The card's frame, head and body, read by the card and by its skeleton. */
const FRAME_CLASS = 'flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-ods-border bg-ods-card';
const HEAD_CLASS = 'flex items-center gap-[var(--spacing-system-mf)] border-b border-ods-border';
const HEAD_TEXT_CLASS = 'flex min-w-0 flex-1 flex-col';
const LEAD_CLASS = 'flex shrink-0 items-center';
const headPadding = (roomy: boolean) => (roomy ? 'p-[var(--spacing-system-l)]' : 'p-[var(--spacing-system-m)]');
const bodyClass = (roomy: boolean) =>
  cn(
    'flex min-w-0 flex-1 flex-col bg-ods-bg',
    roomy
      ? 'gap-[var(--spacing-system-l)] p-[var(--spacing-system-l)]'
      : 'gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] pb-[var(--spacing-system-l)] pt-[var(--spacing-system-m)]',
  );

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
  // In a page's loading state a title still being read is empty: the head is its skeleton, the body (whose own
  // components draw their skeletons) as it is.
  const inScope = useLoadingScope();
  if (inScope && !title) {
    return (
      <StripCardSkeleton
        lead={lead}
        caption={caption !== undefined}
        density={density}
        className={className}
        bodyClassName={bodyClassName}
      >
        {children}
      </StripCardSkeleton>
    );
  }
  return (
    <div className={cn(FRAME_CLASS, className)}>
      <div className={cn(HEAD_CLASS, headPadding(roomy))}>
        {lead && <span className={LEAD_CLASS}>{lead}</span>}
        <div className={HEAD_TEXT_CLASS}>
          <Title className="m-0 text-ods-text-primary text-h3">{title}</Title>
          {caption && <span className="text-ods-text-secondary text-h6">{caption}</span>}
        </div>
      </div>
      <div className={cn(bodyClass(roomy), bodyClassName)}>{children}</div>
    </div>
  );
}

/**
 * A StripCard while its head is read: the same frame, the lead as given (an icon is static, a picture draws its
 * own box), the title a `text-h3` bar and the caption, when the card carries one, a `text-h6` bar. The body is
 * the caller's: its components draw their own skeletons.
 */
function StripCardSkeleton({
  lead,
  caption = false,
  density = 'default',
  children,
  className,
  bodyClassName,
}: Pick<StripCardProps, 'lead' | 'density' | 'children' | 'className' | 'bodyClassName'> & {
  /** The loaded card carries a caption under its title. */
  caption?: boolean;
}) {
  const roomy = density === 'roomy';
  return (
    <div className={cn(FRAME_CLASS, className)}>
      <div className={cn(HEAD_CLASS, headPadding(roomy))} aria-hidden>
        {lead && <span className={LEAD_CLASS}>{lead}</span>}
        <div className={HEAD_TEXT_CLASS}>
          <TextLineSkeleton type="h3" className="w-3/4" />
          {caption && <TextLineSkeleton type="h6" className="w-1/2" />}
        </div>
      </div>
      {/* The body is the caller's, inert while the card is read (its components draw their own skeletons). */}
      <div className={cn(bodyClass(roomy), bodyClassName)} inert>
        {children}
      </div>
    </div>
  );
}
