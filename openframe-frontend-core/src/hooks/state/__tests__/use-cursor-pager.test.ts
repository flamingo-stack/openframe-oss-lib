import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockPush, mockReplace, setMockSearchParams } from '../../../../vitest.setup';
import { isPreviousPageEntry, isStaleCursorPage, useCursorPager } from '../use-cursor-pager';

const ORIGIN = 'http://localhost:3000';

/** Point the URL (router mock and window.location) at `search` on `/devices/details`. */
function setUrl(search: string) {
  setMockSearchParams(new URLSearchParams(search));
  Reflect.set(window.location, 'href', `${ORIGIN}/devices/details${search ? `?${search}` : ''}`);
}

/** A Navigation API whose entry behind the current one is `previousSearch` (or none). */
function setPreviousEntry(previousSearch: string | null) {
  const entries = previousSearch === null ? [] : [{ url: `${ORIGIN}/devices/details?${previousSearch}`, index: 0 }];
  const current = { url: window.location.href, index: entries.length };
  (window as unknown as { navigation?: unknown }).navigation = {
    currentEntry: current,
    entries: () => [...entries, current],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

describe('useCursorPager', () => {
  const back = vi.fn();

  beforeEach(() => {
    setUrl('');
    back.mockClear();
    window.history.back = back;
  });

  afterEach(() => {
    delete (window as unknown as { navigation?: unknown }).navigation;
  });

  it('reads page 1 with no cursor', () => {
    const { result } = renderHook(() => useCursorPager({ prefix: 'sw', pageSize: 20 }));
    expect(result.current.isFirstPage).toBe(true);
    expect(result.current.variables).toEqual({ first: 20, after: null, last: null, before: null });
    expect(result.current.rangeStart).toBe(1);
  });

  it('reads the prefixed cursor and page from the URL', () => {
    setUrl('id=d1&swCursor=Yw%3D%3D&swPage=3');
    const { result } = renderHook(() => useCursorPager({ prefix: 'sw', pageSize: 20 }));
    expect(result.current.cursor).toBe('Yw==');
    expect(result.current.page).toBe(3);
    expect(result.current.rangeStart).toBe(41);
    expect(result.current.variables).toEqual({ first: 20, after: 'Yw==', last: null, before: null });
  });

  it('Next pushes the end cursor and the next page index', () => {
    setUrl('id=d1&swCursor=Yw%3D%3D&swPage=3');
    const { result } = renderHook(() => useCursorPager({ prefix: 'sw', pageSize: 20 }));
    act(() => result.current.goNext('ZA=='));
    expect(mockPush).toHaveBeenCalledTimes(1);
    const written = new URLSearchParams(String(mockPush.mock.calls[0]?.[0]).slice(1));
    expect(written.get('swCursor')).toBe('ZA==');
    expect(written.get('swPage')).toBe('4');
    expect(written.get('id')).toBe('d1');
  });

  it('Previous goes back in history when the entry behind is this table one page earlier', () => {
    setUrl('id=d1&swCursor=Yw%3D%3D&swPage=3');
    setPreviousEntry('id=d1&swCursor=Yg%3D%3D&swPage=2');
    const { result } = renderHook(() => useCursorPager({ prefix: 'sw', pageSize: 20 }));
    expect(result.current.canGoBackInHistory).toBe(true);
    act(() => result.current.goPrevious());
    expect(back).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not go back into ANOTHER entity with the same cursor (group B page cursors repeat)', () => {
    setUrl('id=d2&swCursor=Yw%3D%3D&swPage=3');
    setPreviousEntry('id=d1&swCursor=Yg%3D%3D&swPage=2');
    const { result } = renderHook(() => useCursorPager({ prefix: 'sw', pageSize: 20 }));
    expect(result.current.canGoBackInHistory).toBe(false);
    const footer = result.current.footerProps({ hasNextPage: true, startCursor: 'Yw==', endCursor: 'ZA==' });
    expect(footer.hasPreviousPage).toBe(false);
  });

  it('without history, Previous on page 2 is the first page', () => {
    setUrl('swCursor=Yg%3D%3D&swPage=2');
    const { result } = renderHook(() => useCursorPager({ prefix: 'sw', pageSize: 20 }));
    expect(result.current.footerProps({ hasNextPage: true }).hasPreviousPage).toBe(true);
    act(() => result.current.goPrevious());
    expect(back).not.toHaveBeenCalled();
    expect(mockPush.mock.calls[0]?.[0]).toBe('/');
  });

  it('with serverPrev, Previous asks the server for the page before the start cursor', () => {
    setUrl('swCursor=Yw%3D%3D&swPage=3');
    const { result } = renderHook(() => useCursorPager({ prefix: 'sw', pageSize: 20, serverPrev: true }));
    act(() => result.current.goPrevious('c3RhcnQ='));
    const written = new URLSearchParams(String(mockPush.mock.calls[0]?.[0]).slice(1));
    expect(written.get('swCursor')).toBe('c3RhcnQ=');
    expect(written.get('swDir')).toBe('before');
    expect(written.get('swPage')).toBe('2');
  });

  it('reads a backward page with last/before only on a serverPrev list', () => {
    setUrl('swCursor=Yw%3D%3D&swPage=2&swDir=before');
    const server = renderHook(() => useCursorPager({ prefix: 'sw', pageSize: 20, serverPrev: true }));
    expect(server.result.current.variables).toEqual({ first: null, after: null, last: 20, before: 'Yw==' });
    expect(server.result.current.footerProps({ hasNextPage: false }).hasNextPage).toBe(true);

    // A list that silently returns the NEXT page for `before` never gets it.
    const forwardOnly = renderHook(() => useCursorPager({ prefix: 'sw', pageSize: 20 }));
    expect(forwardOnly.result.current.variables).toEqual({ first: 20, after: 'Yw==', last: null, before: null });
  });

  it('without serverPrev and history, Previous on page 3 stays off and First stays on', () => {
    setUrl('swCursor=Yw%3D%3D&swPage=3');
    const { result } = renderHook(() => useCursorPager({ prefix: 'sw', pageSize: 20 }));
    const footer = result.current.footerProps({ hasNextPage: true, startCursor: 'Yw==' });
    expect(footer.hasPreviousPage).toBe(false);
    expect(footer.isFirstPage).toBe(false);
    act(() => footer.onFirst());
    expect(mockPush.mock.calls[0]?.[0]).toBe('/');
  });

  it('never sends a cursor issued under other filters, and drops it from the URL', () => {
    setUrl('swCursor=Yw%3D%3D&swPage=3');
    const { result, rerender } = renderHook(
      ({ filters }) => useCursorPager({ prefix: 'sw', pageSize: 20, resetOn: filters }),
      {
        initialProps: { filters: 'a' },
      },
    );
    expect(result.current.cursor).toBe('Yw==');
    rerender({ filters: 'b' });
    expect(result.current.cursor).toBeNull();
    expect(result.current.variables.after).toBeNull();
    expect(mockReplace).toHaveBeenCalled();
    expect(String(mockReplace.mock.calls[mockReplace.mock.calls.length - 1]?.[0])).not.toContain('swCursor');
  });

  it('dropCursor leaves the cursor without a history entry', () => {
    setUrl('swCursor=Yw%3D%3D&swPage=3&tab=sw');
    const { result } = renderHook(() => useCursorPager({ prefix: 'sw', pageSize: 20 }));
    act(() => result.current.dropCursor());
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace.mock.calls[0]?.[0]).toBe('?tab=sw');
  });

  it('a cursor with no page index reads no range', () => {
    setUrl('swCursor=Yw%3D%3D');
    const { result } = renderHook(() => useCursorPager({ prefix: 'sw', pageSize: 20 }));
    expect(result.current.page).toBeUndefined();
    expect(result.current.rangeStart).toBeUndefined();
  });
});

describe('isPreviousPageEntry', () => {
  const current = `${ORIGIN}/scripts?q=a&cursor=Yw%3D%3D&page=3`;

  it('matches the same view one page earlier, and page 1 without a cursor', () => {
    expect(isPreviousPageEntry(`${ORIGIN}/scripts?q=a&cursor=Yg%3D%3D&page=2`, current, '', 3)).toBe(true);
    expect(isPreviousPageEntry(`${ORIGIN}/scripts?q=a`, `${ORIGIN}/scripts?q=a&cursor=Yg%3D%3D&page=2`, '', 2)).toBe(
      true,
    );
  });

  it('rejects other filters, other paths and other pages', () => {
    expect(isPreviousPageEntry(`${ORIGIN}/scripts?q=b&cursor=Yg%3D%3D&page=2`, current, '', 3)).toBe(false);
    expect(isPreviousPageEntry(`${ORIGIN}/devices?q=a&cursor=Yg%3D%3D&page=2`, current, '', 3)).toBe(false);
    expect(isPreviousPageEntry(`${ORIGIN}/scripts?q=a&cursor=Yg%3D%3D&page=1`, current, '', 3)).toBe(false);
    expect(isPreviousPageEntry(null, current, '', 3)).toBe(false);
  });
});

describe('isStaleCursorPage', () => {
  it('an empty page 2+ is stale; the first page never is', () => {
    expect(isStaleCursorPage({ cursor: 'Yw==', rowCount: 0, pageInfo: null })).toBe(true);
    expect(isStaleCursorPage({ cursor: null, rowCount: 0, pageInfo: null })).toBe(false);
  });

  it('hasPreviousPage=false on page 2+ is stale only where it is reliable, and never on a backward page', () => {
    const pageInfo = { hasNextPage: true, hasPreviousPage: false };
    expect(isStaleCursorPage({ cursor: 'Yw==', rowCount: 20, pageInfo })).toBe(false);
    expect(isStaleCursorPage({ cursor: 'Yw==', rowCount: 20, pageInfo, reliableHasPrev: true })).toBe(true);
    expect(isStaleCursorPage({ cursor: 'Yw==', rowCount: 20, pageInfo, reliableHasPrev: true, backward: true })).toBe(
      false,
    );
  });
});
