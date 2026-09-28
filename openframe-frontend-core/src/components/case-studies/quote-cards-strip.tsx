'use client';

import { CardHitLayer } from '../features/card-hit-layer';
import { CardsStrip } from '../features/cards-strip';
import { Card } from '../ui/card';
import { PersonCell } from '../ui/people-cell';

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
        <Card
          key={ctx.cardKey}
          aria-hidden={ctx.isClone || undefined}
          onPointerEnter={ctx.isTouch ? undefined : () => ctx.onActivate(ctx.cardKey)}
          onPointerLeave={ctx.isTouch ? undefined : () => ctx.onDeactivate(ctx.cardKey)}
          className="relative shrink-0 rounded-md border-ods-border bg-ods-card p-[var(--spacing-system-sf)] shadow-none hover:border-ods-border-hover"
        >
          <PersonCell size="lg" name={`"${quote.text}"`} secondary={quote.attribution} avatarUrl={quote.logoUrl} />
          <CardHitLayer href={quote.href} label={`${quote.text}, ${quote.attribution}`} decorative={ctx.isClone} />
        </Card>
      )}
    />
  );
}
