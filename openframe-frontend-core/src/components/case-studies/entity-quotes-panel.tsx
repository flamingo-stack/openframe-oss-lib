'use client';

import type { EntityQuote } from '../../types/video-processing';
import { ENTITY_QUOTES_TITLE } from '../../types/video-processing';
import { StackedRowsPanel } from '../ui';

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
export function EntityQuotesPanel({ quotes, className }: EntityQuotesPanelProps) {
  if (!quotes || quotes.length === 0) return null;
  return (
    <StackedRowsPanel
      className={className}
      title={`${ENTITY_QUOTES_TITLE} · ${quotes.length}`}
      rows={quotes.map(q => ({
        id: q.key,
        columns: [
          {
            key: 'quote',
            content: (
              <blockquote className="flex flex-col gap-[var(--spacing-system-xxs)]">
                <p className="text-ods-text-primary text-h4">&ldquo;{q.text}&rdquo;</p>
                {q.speaker && <p className="text-ods-text-secondary text-h4">{q.speaker}</p>}
              </blockquote>
            ),
          },
        ],
      }))}
    />
  );
}
