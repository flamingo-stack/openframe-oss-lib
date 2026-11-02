import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
