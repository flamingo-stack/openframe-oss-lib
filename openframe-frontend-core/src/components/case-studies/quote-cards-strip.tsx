'use client';

import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';
import { CardHitLayer } from '../features/card-hit-layer';
import { CardsStrip } from '../features/cards-strip';
import { LoadingRegion } from '../loading/loading-region';
import { Card } from '../ui/card';
import { useLoadingScope } from '../ui/loading-scope';
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

interface QuoteCardTileOptions extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** The strip's loop clone: it keeps the click but stays out of the a11y tree. */
  decorative?: boolean;
}

/** The quote, or `loading` while it is read: the card then draws its own loading form (also in a loading scope). */
export type QuoteCardTileProps = QuoteCardTileOptions &
  ({ quote: QuoteCard; loading?: boolean } | { quote?: undefined; loading: true });

const QUOTE_CARD_CLASS = 'relative p-[var(--spacing-system-sf)]';

/**
 * ONE customer quote card: the line as the person's name, who said it beneath,
 * their logo, and the whole card opening the case study it comes from. The
 * strip draws one per quote; a page that shows a single story draws one alone.
 */
export function QuoteCardTile({ quote, decorative, className, loading, ...props }: QuoteCardTileProps) {
  // ONE switch: while the quote is read (`loading`, or a loading scope) the card is its own loading form.
  if (useLoadingScope() || loading || !quote) return <QuoteCardTileSkeleton className={className} />;
  return (
    <Card
      variant="panel"
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
function QuoteCardTileSkeleton({ className }: { className?: string }) {
  return (
    <Card variant="panel" className={cn(QUOTE_CARD_CLASS, className)}>
      <LoadingRegion label="Loading a customer story">
        <PersonCell loading size="lg" />
      </LoadingRegion>
    </Card>
  );
}

export interface QuoteCardsStripProps {
  quotes: readonly QuoteCard[];
  /** The quotes are being read (the host's query runs): the strip draws its own skeleton. A page's loading scope does too. */
  loading?: boolean;
  /**
   * The quote cards the skeleton draws: the number of quotes the host reads (its limit). Default
   * `QUOTE_STRIP_SKELETON_CARDS`, a typical count for a host that states none.
   */
  skeletonCount?: number;
  /** @deprecated Ignored: the skeleton draws `skeletonCount` (a list draws its full count, never a fold). */
  fold?: number;
  className?: string;
}

/** The quote cards a strip's skeleton draws when its host names no count: a typical count. */
const QUOTE_STRIP_SKELETON_CARDS = 4;

/** The strip while its quotes are read: the same strip engine, still, with the quote card's own skeleton. */
function QuoteCardsStripSkeleton({ count, className }: { count: number; className?: string }) {
  return (
    <CardsStrip
      className={className}
      showTitle={false}
      showChevrons={false}
      autoScroll={false}
      items={Array.from({ length: count }, (_, index) => ({ key: `quote-${index}` }))}
      itemKey={item => item.key}
      renderCard={(_item, ctx) => <QuoteCardTile key={ctx.cardKey} loading className="shrink-0" />}
    />
  );
}

/**
 * A scrolling row of customer quote chips on THE strip engine every card rail
 * uses (`CardsStrip`, render-prop mode so each chip keeps its natural width).
 * The whole chip opens the case study the quote comes from; the loop clone
 * keeps the click but stays out of the a11y tree. While its quotes are read (a page's loading scope with none handed
 * over, or `loading`) it is its own skeleton; read and empty, it renders nothing.
 */
export function QuoteCardsStrip({ quotes, loading = false, skeletonCount, className }: QuoteCardsStripProps) {
  const scoped = useLoadingScope();
  if ((scoped && quotes.length === 0) || loading) {
    return <QuoteCardsStripSkeleton count={skeletonCount ?? QUOTE_STRIP_SKELETON_CARDS} className={className} />;
  }
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
