/**
 * `MingoHistoryRail`, the "Current Chats" list (a phone's Mingo list): with `loadMore="button"`
 * it holds the page it has and loads the next one on "Show more" only, as the sidebar's
 * history does. Scrolling it into view chained page after page while the list was shorter
 * than its column, and a shared list showed them all everywhere.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MingoHistoryRail } from '../mingo-history-rail';
import type { DialogItem } from '../types/component.types';

const DIALOGS: DialogItem[] = [
  { id: 'a', title: 'osquery check', timestamp: new Date(2026, 9, 15, 9, 30) },
  { id: 'b', title: 'Patch reports', timestamp: new Date(2026, 9, 14, 23, 50) },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Every IntersectionObserver alive reports its target in view. */
function stubObserversInView() {
  const live = new Set<IntersectionObserverCallback>();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private readonly callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }
      observe() {
        live.add(this.callback);
      }
      disconnect() {
        live.delete(this.callback);
      }
      unobserve() {}
      takeRecords() {
        return [];
      }
    },
  );
  return () =>
    act(() => {
      for (const notify of live)
        notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
}

describe('MingoHistoryRail loadMore', () => {
  it('loads the next page on "Show more" only, with loadMore="button"', () => {
    const showEnd = stubObserversInView();
    const onLoadMore = vi.fn();
    render(<MingoHistoryRail dialogs={DIALOGS} hasMore onLoadMore={onLoadMore} loadMore="button" />);
    showEnd();
    expect(onLoadMore).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('still loads as the end shows by default', () => {
    const showEnd = stubObserversInView();
    const onLoadMore = vi.fn();
    render(<MingoHistoryRail dialogs={DIALOGS} hasMore onLoadMore={onLoadMore} />);
    showEnd();
    expect(onLoadMore).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });
});
