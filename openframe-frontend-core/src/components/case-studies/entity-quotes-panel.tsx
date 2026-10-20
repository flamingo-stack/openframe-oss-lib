'use client';

import type { EntityQuote } from '../../types/video-processing';
import { ENTITY_QUOTES_TITLE } from '../../types/video-processing';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { StackedRowsPanel } from '../ui';
import { useLoadingScope } from '../ui/loading-scope';

export interface EntityQuotesPanelProps {
  /** A record's `quotes` column (case study, customer interview, prospect call). */
  quotes: readonly EntityQuote[] | null | undefined;
  className?: string;
}

/**
 * THE quote list display: one `StackedRowsPanel` row per quote, the quote
 * with its speaker beneath, under a "Key Quotes · N" caption. Renders nothing
 * when there are none.
 */
/** The quote's layout, read by the panel and by its skeleton. */
const QUOTE_CLASS = 'flex flex-col gap-[var(--spacing-system-xxs)]';
const QUOTE_TEXT_CLASS = 'text-ods-text-primary text-h4';
const QUOTE_SPEAKER_CLASS = 'text-ods-text-secondary text-h4';
/** Quote rows the skeleton draws: the panel shows every quote (no fold), so the panel's own default count. */
const QUOTES_SKELETON_ROWS = 3;

export function EntityQuotesPanel({ quotes, className }: EntityQuotesPanelProps) {
  // Quotes are optional per record: a loading state cannot know a panel will be there, so it draws none (the
  // panel's skeleton is for a host that knows it has quotes).
  if (useLoadingScope()) return null;
  if (!quotes || quotes.length === 0) return null;
  return (
    // Optional per record, so the loading state draws none: the gate leaves the loaded panel out of its comparison.
    // A plain block around the one panel, so the parent's spacing applies to it as it did to the panel.
    <div data-loading-optional>
    <StackedRowsPanel
      className={className}
      title={`${ENTITY_QUOTES_TITLE} · ${quotes.length}`}
      rows={quotes.map(q => ({
        id: q.key,
        columns: [
          {
            key: 'quote',
            content: (
              <blockquote className={QUOTE_CLASS}>
                <p className={QUOTE_TEXT_CLASS}>&ldquo;{q.text}&rdquo;</p>
                {q.speaker && <p className={QUOTE_SPEAKER_CLASS}>{q.speaker}</p>}
              </blockquote>
            ),
          },
        ],
      }))}
    />
    </div>
  );
}

/**
 * The quotes while they are read: the real "Key Quotes" caption (its count is read data, so it is left out) over
 * the panel's rows, each a quote's two lines and its speaker line as bars in the quote's own elements.
 */
export function EntityQuotesPanelSkeleton({ className }: { className?: string }) {
  return (
    <StackedRowsPanel
      className={className}
      title={ENTITY_QUOTES_TITLE}
      rows={Array.from({ length: QUOTES_SKELETON_ROWS }, (_, i) => ({
        id: `skeleton-${i}`,
        columns: [
          {
            key: 'quote',
            content: (
              <div className={QUOTE_CLASS} aria-hidden>
                <p className={QUOTE_TEXT_CLASS}>
                  <TextLineSkeleton type="inherit" as="span" lines={2} className="w-full" />
                </p>
                <p className={QUOTE_SPEAKER_CLASS}>
                  <TextLineSkeleton type="inherit" as="span" className="w-40" />
                </p>
              </div>
            ),
          },
        ],
      }))}
    />
  );
}
