'use client';

import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';
import { CardHitLayer } from '../features/card-hit-layer';
import { CardsStrip } from '../features/cards-strip';
import { LoadingRegion } from '../loading/loading-region';
import { Card } from '../ui/card';
import { PersonCell, PersonCellSkeleton } from '../ui/people-cell';

/** One customer quote chip: the line, who said it, their logo, and the case study it opens. */
export interface QuoteCard {
  key: string;
  text: string;
  /** "Albert Guerra, Owner" — the customer's name and job title. */
  attribution: string;
  /** The customer's MSP logo, else their avatar. */
  logoUrl: string | null;
  /** The case study the quote comes from. */
  href: string;
}

export interface QuoteCardTileProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  quote: QuoteCard;
  /** The strip's loop clone: it keeps the click but stays out of the a11y tree. */
  decorative?: boolean;
}

/**
 * ONE customer quote card: the line as the person's name, who said it beneath,
 * their logo, and the whole card opening the case study it comes from. The
 * strip draws one per quote; a page that shows a single story draws one alone.
 */
const QUOTE_CARD_CLASS = 'relative p-[var(--spacing-system-sf)]';

export function QuoteCardTile({ quote, decorative, className, ...props }: QuoteCardTileProps) {
  return (
    <Card variant="panel"
      aria-hidden={decorative || undefined}
      className={cn(QUOTE_CARD_CLASS, 'hover:border-ods-border-hover', className)}
      {...props}
    >
      <PersonCell size="lg" name={`"${quote.text}"`} secondary={quote.attribution} avatarUrl={quote.logoUrl} />
      <CardHitLayer href={quote.href} label={`${quote.text}, ${quote.attribution}`} decorative={decorative} />
    </Card>
  );
}

/** One quote card while it loads: the same card and the person cell's own skeleton. */
export function QuoteCardTileSkeleton({ className }: { className?: string }) {
  return (
    <Card variant="panel" className={cn(QUOTE_CARD_CLASS, className)}>
      <LoadingRegion label="Loading a customer story">
        <PersonCellSkeleton size="lg" />
      </LoadingRegion>
    </Card>
  );
}

export interface QuoteCardsStripProps {
  quotes: readonly QuoteCard[];
  className?: string;
}

/**
 * A scrolling row of customer quote chips on THE strip engine every card rail
 * uses (`CardsStrip`, render-prop mode so each chip keeps its natural width).
 * The whole chip opens the case study the quote comes from; the loop clone
 * keeps the click but stays out of the a11y tree. Renders nothing when empty.
 */
export function QuoteCardsStrip({ quotes, className }: QuoteCardsStripProps) {
  if (quotes.length === 0) return null;
  return (
    <CardsStrip
      className={className}
      showTitle={false}
      showChevrons={false}
      items={[...quotes]}
      itemKey={quote => quote.key}
      renderCard={(quote, ctx) => (
        <QuoteCardTile
          key={ctx.cardKey}
          quote={quote}
          decorative={ctx.isClone}
          onPointerEnter={ctx.isTouch ? undefined : () => ctx.onActivate(ctx.cardKey)}
          onPointerLeave={ctx.isTouch ? undefined : () => ctx.onDeactivate(ctx.cardKey)}
          className="shrink-0"
        />
      )}
    />
  );
}
