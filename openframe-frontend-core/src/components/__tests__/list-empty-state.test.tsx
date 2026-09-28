/**
 * `ListEmptyState` — the two cases of an empty filterable list, pinned.
 *
 *   1. a filtered miss renders the `search` EmptyState with a secondary reset button that calls
 *      `onClearFilters`;
 *   2. a genuinely empty list renders the `generic` EmptyState, and its button appears ONLY when
 *      the caller gave it both a label and an action. Without that guard `EmptyState` falls back to
 *      its path-sniffed default ("Browse Vendors") on a surface that never asked for one.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListEmptyState } from '../list-empty-state';

const filtered = { title: 'No tickets found', description: 'Nothing matches your filters.' };
const empty = { title: 'No tickets yet', description: 'Open one above.' };

describe('ListEmptyState', () => {
  it('offers to clear the filters on a filtered miss', () => {
    const onClearFilters = vi.fn();
    const onCtaClick = vi.fn();
    render(
      <ListEmptyState
        isFiltered
        filtered={filtered}
        onClearFilters={onClearFilters}
        empty={{ ...empty, ctaText: 'Create first', onCtaClick }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'No tickets found' })).toBeTruthy();
    expect(screen.getByText('Nothing matches your filters.')).toBeTruthy();
    expect(screen.queryByText('Create first')).toBeNull();

    const clear = screen.getByRole('button', { name: 'Clear filters' });
    expect(clear.className).toContain('border-ods-border');
    fireEvent.click(clear);
    expect(onClearFilters).toHaveBeenCalledTimes(1);
    expect(onCtaClick).not.toHaveBeenCalled();
  });

  it('uses the caller label for the reset button', () => {
    render(
      <ListEmptyState
        isFiltered
        filtered={{ ...filtered, clearText: 'Reset filters' }}
        onClearFilters={() => undefined}
        empty={empty}
      />,
    );
    expect(screen.getByRole('button', { name: 'Reset filters' })).toBeTruthy();
  });

  it('renders the empty list with its own action', () => {
    const onClearFilters = vi.fn();
    const onCtaClick = vi.fn();
    render(
      <ListEmptyState
        isFiltered={false}
        filtered={filtered}
        onClearFilters={onClearFilters}
        empty={{ ...empty, ctaText: 'Create first', onCtaClick }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'No tickets yet' })).toBeTruthy();
    const cta = screen.getByRole('button', { name: 'Create first' });
    expect(cta.className).toContain('bg-ods-accent');
    fireEvent.click(cta);
    expect(onCtaClick).toHaveBeenCalledTimes(1);
    expect(onClearFilters).not.toHaveBeenCalled();
  });

  it('renders no button for an empty list without an action', () => {
    render(<ListEmptyState isFiltered={false} filtered={filtered} onClearFilters={() => undefined} empty={empty} />);

    expect(screen.getByRole('heading', { name: 'No tickets yet' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders no button when the empty CTA has a label but no action', () => {
    render(
      <ListEmptyState
        isFiltered={false}
        filtered={filtered}
        onClearFilters={() => undefined}
        empty={{ ...empty, ctaText: 'Create first' }}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders the empty CTA as a link when given an href', () => {
    render(
      <ListEmptyState
        isFiltered={false}
        filtered={filtered}
        onClearFilters={() => undefined}
        empty={{ ...empty, ctaText: 'Back to blog', ctaHref: '/blog' }}
      />,
    );
    expect(screen.getByRole('link', { name: 'Back to blog' }).getAttribute('href')).toBe('/blog');
  });
});
