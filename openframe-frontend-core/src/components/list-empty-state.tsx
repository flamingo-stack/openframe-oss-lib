'use client';

import { EmptyState } from './empty-state';

export interface ListEmptyStateCopy {
  title: string;
  description: string;
}

export interface ListEmptyStateProps {
  /** A search or filter is narrowing the list, so "nothing to show" is a miss, not an empty list. */
  isFiltered: boolean;
  /** Copy for the filtered miss. `clearText` labels the reset button (default "Clear filters"). */
  filtered: ListEmptyStateCopy & { clearText?: string };
  /** Resets every search and filter the list owns. */
  onClearFilters: () => void;
  /**
   * Copy for a genuinely empty list, with an optional call to action (e.g. "Create the first one").
   * The CTA renders only when `ctaText` comes with `onCtaClick` or `ctaHref`, so an empty list with
   * no action never falls through to `EmptyState`'s path-sniffed default button.
   */
  empty: ListEmptyStateCopy & { ctaText?: string; onCtaClick?: () => void; ctaHref?: string };
}

/**
 * THE empty state of a searchable, filterable list: a filtered miss offers to clear the filters
 * (`search` icon, secondary button), a genuinely empty list says so and optionally offers its own
 * action (`generic` icon, primary button). Every list with filters renders this instead of choosing
 * between two `EmptyState`s by hand, so the two cases look and behave the same everywhere.
 */
export function ListEmptyState({ isFiltered, filtered, onClearFilters, empty }: ListEmptyStateProps) {
  if (isFiltered) {
    return (
      <EmptyState
        type="search"
        title={filtered.title}
        description={filtered.description}
        ctaText={filtered.clearText ?? 'Clear filters'}
        onCtaClick={onClearFilters}
        ctaVariant="secondary"
      />
    );
  }

  const hasCta = Boolean(empty.ctaText && (empty.onCtaClick || empty.ctaHref));
  return (
    <EmptyState
      type="generic"
      title={empty.title}
      description={empty.description}
      showCTA={hasCta}
      ctaText={empty.ctaText}
      onCtaClick={empty.onCtaClick}
      ctaHref={empty.ctaHref}
    />
  );
}
