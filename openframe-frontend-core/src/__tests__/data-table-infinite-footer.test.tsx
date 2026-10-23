import { createColumnHelper } from '@tanstack/react-table';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataTable } from '../components/ui/data-table';
import { useDataTable } from '../components/ui/data-table/use-data-table';

/**
 * `<DataTable.InfiniteFooter>` decides WHEN the next page is asked for. Two
 * things it got wrong, both invisible in a window-scrolled demo:
 *
 * - It observed against the viewport. The apps scroll a nested `<main>`, and a
 *   scrolling ancestor clips the intersection regardless of `rootMargin`, so
 *   the pre-fetch lead was zero: the request left once the user had run out of
 *   rows.
 * - A fetch that added nothing (an error, an empty page) re-armed the observer
 *   with the sentinel still in view, which fired the same request again —
 *   forever.
 */

interface Row {
  id: string;
  name: string;
}

const columnHelper = createColumnHelper<Row>();
const columns = [columnHelper.accessor('name', { id: 'name', header: 'Name' })];
const rows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: String(i), name: `Row ${i}` }));

/** jsdom has no IntersectionObserver; this one records how it was set up and fires on demand. */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  disconnected = false;
  constructor(
    private readonly callback: IntersectionObserverCallback,
    readonly options: IntersectionObserverInit = {},
  ) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  takeRecords() {
    return [];
  }
  /** The sentinel came into range. */
  intersect() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

const liveObservers = () => FakeIntersectionObserver.instances.filter(observer => !observer.disconnected);

function Table({
  data,
  isFetchingNextPage = false,
  onLoadMore,
  loadedCount,
}: {
  data: Row[];
  isFetchingNextPage?: boolean;
  onLoadMore: () => void;
  loadedCount?: number;
}) {
  const table = useDataTable({ data, columns });
  return (
    <DataTable table={table}>
      <DataTable.Body<Row> />
      <DataTable.InfiniteFooter
        hasNextPage
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={onLoadMore}
        loadedCount={loadedCount}
      />
    </DataTable>
  );
}

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DataTable.InfiniteFooter', () => {
  it('asks for the next page one scroller-height ahead, not two rows', () => {
    render(<Table data={rows(3)} onLoadMore={vi.fn()} />);
    expect(liveObservers()[0]?.options.rootMargin).toBe('0px 0px 100% 0px');
  });

  it('roots the observer on the ancestor that scrolls, so the lead is not clipped away', () => {
    // No layout in jsdom: state the two facts `findScrollParent` reads.
    const scroller = document.createElement('div');
    scroller.style.overflowY = 'auto';
    Object.defineProperty(scroller, 'scrollHeight', { value: 2000 });
    Object.defineProperty(scroller, 'clientHeight', { value: 600 });
    document.body.appendChild(scroller);

    render(<Table data={rows(3)} onLoadMore={vi.fn()} />, { container: scroller });

    expect(liveObservers()[0]?.options.root).toBe(scroller);
    scroller.remove();
  });

  it('does NOT root on a wrapper that only scrolls sideways', () => {
    // `overflow-x: auto` computes `overflow-y: auto` as well, but the wrapper is
    // as tall as its content — as a root it would hold the sentinel permanently
    // and every page would load at once.
    const wrapper = document.createElement('div');
    wrapper.style.overflowY = 'auto';
    Object.defineProperty(wrapper, 'scrollHeight', { value: 2000 });
    Object.defineProperty(wrapper, 'clientHeight', { value: 2000 });
    document.body.appendChild(wrapper);

    render(<Table data={rows(3)} onLoadMore={vi.fn()} />, { container: wrapper });

    expect(liveObservers()[0]?.options.root).toBeNull();
    wrapper.remove();
  });

  it('falls back to the viewport when it is the DOCUMENT that scrolls', () => {
    // `<body>` as a root is document-tall: the sentinel would always be inside
    // it, and every page would load at once.
    const overflowY = document.body.style.overflowY;
    document.body.style.overflowY = 'scroll';
    const scrollHeight = vi.spyOn(document.body, 'scrollHeight', 'get').mockReturnValue(5000);
    const clientHeight = vi.spyOn(document.body, 'clientHeight', 'get').mockReturnValue(800);

    render(<Table data={rows(3)} onLoadMore={vi.fn()} />);

    expect(liveObservers()[0]?.options.root).toBeNull();
    document.body.style.overflowY = overflowY;
    scrollHeight.mockRestore();
    clientHeight.mockRestore();
  });

  it('chains the next page when a fetch made progress', () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(<Table data={rows(3)} onLoadMore={onLoadMore} />);

    act(() => liveObservers()[0]?.intersect());
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(<Table data={rows(3)} isFetchingNextPage onLoadMore={onLoadMore} />);
    expect(liveObservers()).toHaveLength(0);

    // The page arrived: a fresh observer is armed for the one after it.
    rerender(<Table data={rows(6)} onLoadMore={onLoadMore} />);
    expect(liveObservers()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('stops auto-loading when a fetch adds NO rows, instead of looping the request', () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(<Table data={rows(3)} onLoadMore={onLoadMore} />);

    act(() => liveObservers()[0]?.intersect());
    rerender(<Table data={rows(3)} isFetchingNextPage onLoadMore={onLoadMore} />);
    // Failed, or came back empty: same rows, still claims a next page.
    rerender(<Table data={rows(3)} onLoadMore={onLoadMore} />);

    // Nothing is left armed to fire the same request again…
    expect(liveObservers()).toHaveLength(0);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    // …and the way forward is the user's to take.
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  it('does NOT park when the list was REPLACED while a page was in flight', () => {
    // A new search lands mid-fetch: the in-flight page is dropped and the fetch
    // ends with FEWER rows than it started with. That is a new list to keep
    // loading, not a stalled one.
    const onLoadMore = vi.fn();
    const { rerender } = render(<Table data={rows(6)} onLoadMore={onLoadMore} />);

    rerender(<Table data={rows(6)} isFetchingNextPage onLoadMore={onLoadMore} />);
    rerender(<Table data={rows(2)} onLoadMore={onLoadMore} />);

    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    expect(liveObservers()).toHaveLength(1);
  });

  it('keeps walking when a page ARRIVED but client-side narrowing showed none of it', () => {
    // A table that filters its loaded pages: 20 more rows were fetched, none
    // matched. The match may be on the next page, so this is not a stall.
    const onLoadMore = vi.fn();
    const { rerender } = render(<Table data={rows(3)} loadedCount={20} onLoadMore={onLoadMore} />);

    rerender(<Table data={rows(3)} loadedCount={20} isFetchingNextPage onLoadMore={onLoadMore} />);
    rerender(<Table data={rows(3)} loadedCount={40} onLoadMore={onLoadMore} />);

    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    expect(liveObservers()).toHaveLength(1);
  });

  it('still parks such a table when the fetch itself brought nothing', () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(<Table data={rows(3)} loadedCount={20} onLoadMore={onLoadMore} />);

    rerender(<Table data={rows(3)} loadedCount={20} isFetchingNextPage onLoadMore={onLoadMore} />);
    rerender(<Table data={rows(3)} loadedCount={20} onLoadMore={onLoadMore} />);

    expect(screen.getByRole('button', { name: 'Load more' })).toBeDefined();
    expect(liveObservers()).toHaveLength(0);
  });

  it('re-arms once a retry makes progress', () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(<Table data={rows(3)} onLoadMore={onLoadMore} />);

    rerender(<Table data={rows(3)} isFetchingNextPage onLoadMore={onLoadMore} />);
    rerender(<Table data={rows(3)} onLoadMore={onLoadMore} />);
    expect(screen.getByRole('button', { name: 'Load more' })).toBeDefined();

    rerender(<Table data={rows(3)} isFetchingNextPage onLoadMore={onLoadMore} />);
    rerender(<Table data={rows(6)} onLoadMore={onLoadMore} />);

    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    expect(liveObservers()).toHaveLength(1);
  });

  it('re-arms when the rows are replaced under a parked footer (a new search)', () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(<Table data={rows(3)} onLoadMore={onLoadMore} />);

    rerender(<Table data={rows(3)} isFetchingNextPage onLoadMore={onLoadMore} />);
    rerender(<Table data={rows(3)} onLoadMore={onLoadMore} />);
    expect(liveObservers()).toHaveLength(0);

    rerender(<Table data={rows(5)} onLoadMore={onLoadMore} />);
    expect(liveObservers()).toHaveLength(1);
  });

  it('tells a screen reader that more is loading', () => {
    const { rerender } = render(<Table data={rows(3)} onLoadMore={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toBe('');

    rerender(<Table data={rows(3)} isFetchingNextPage onLoadMore={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toBe('Loading more results');
  });
});
