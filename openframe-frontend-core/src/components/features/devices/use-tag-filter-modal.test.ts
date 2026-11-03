import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentAreaWidthContext } from '../../../hooks/ui/use-content-breakpoint';
import { getDeviceFilterColumns } from './devices-table-columns';
import { useTagFilterModal } from './use-tag-filter-modal';

/** Applies the modal the way FilterModal does: the column filters first, then the tags. */
function apply(columns: ReturnType<typeof getDeviceFilterColumns>, columnFilters: Record<string, string[]>) {
  const setParams = vi.fn();
  const { result } = renderHook(() =>
    useTagFilterModal({ tags: [], deviceFilters: null, columns, setParams, onApplied: () => {} }),
  );
  act(() => {
    result.current.handleFilterChange(columnFilters);
    result.current.handleTagsChange([]);
  });
  return setParams.mock.calls[0][0] as Record<string, string[]>;
}

describe('useTagFilterModal', () => {
  const directoryColumns = getDeviceFilterColumns(null, { directoryColumns: true });

  it('sends the ticked USER and SOURCES options', () => {
    const params = apply(directoryColumns, { user: ['PRIMARY'], sources: ['MICROSOFT_365'] });

    expect(params.userLinks).toEqual(['PRIMARY']);
    expect(params.directorySources).toEqual(['MICROSOFT_365']);
  });

  // FilterModal drops a group whose last option was unticked, and Reset sends no group at all
  it('clears USER and SOURCES when no option of theirs is ticked', () => {
    const params = apply(directoryColumns, { status: ['ONLINE'] });

    expect(params.userLinks).toEqual([]);
    expect(params.directorySources).toEqual([]);
  });

  it('leaves the directory params out for a host without the directory columns', () => {
    const params = apply(getDeviceFilterColumns(null), {});

    expect(params).not.toHaveProperty('userLinks');
    expect(params).not.toHaveProperty('directorySources');
  });
});

/** The filter window's groups, for a host laid out in a content area this wide. */
function groupIds(columns: ReturnType<typeof getDeviceFilterColumns>, contentWidth: number) {
  const { result } = renderHook(
    () => useTagFilterModal({ tags: [], deviceFilters: null, columns, setParams: vi.fn(), onApplied: () => {} }),
    {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(ContentAreaWidthContext.Provider, { value: contentWidth }, children),
    },
  );
  return result.current.filterGroups.map(group => group.id);
}

describe('useTagFilterModal filter groups', () => {
  const directoryColumns = getDeviceFilterColumns(null, { directoryColumns: true });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('follows the content area: a docked panel narrowing it under a wide window brings every group back', () => {
    const narrowWindow = window.matchMedia;
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ ...narrowWindow(query), matches: true }));

    expect(groupIds(directoryColumns, 600)).toEqual(['user', 'sources', 'status', 'os', 'organization']);
  });

  it('leaves a tablet-width area to the header funnels', () => {
    expect(groupIds(directoryColumns, 800)).toEqual([]);
  });

  it('carries SOURCES on a desktop-width area, where beside the customer column its header has no funnel', () => {
    expect(groupIds(directoryColumns, 1100)).toEqual(['sources']);
  });

  it("leaves SOURCES to the header on one customer's list", () => {
    const columns = getDeviceFilterColumns(null, { directoryColumns: true, roomyDirectory: true });

    expect(groupIds(columns, 1100)).toEqual([]);
  });
});
