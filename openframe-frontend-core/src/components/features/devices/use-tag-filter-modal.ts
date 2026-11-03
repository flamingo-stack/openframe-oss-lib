'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useContentBreakpoint } from '../../../hooks/ui/use-content-breakpoint';
import type { DeviceFilters } from './types';

function isCompleteTag(tag: string): boolean {
  const i = tag.indexOf(':');
  return i > 0 && i < tag.length - 1;
}

/** One selectable value in a FilterModal group. */
interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

interface UseTagFilterModalParams {
  tags: string[];
  deviceFilters: DeviceFilters | null;
  columns: Array<{
    key: string;
    label: string;
    filterable?: boolean;
    filterOptions?: FilterOption[];
    inWindowOnDesktop?: boolean;
  }>;
  /** `useApiParams`' setter, each device list param is a list of ids. */
  setParams: (params: Record<string, string[]>) => void;
  /**
   * Runs after the filters are applied, to bring the list back to its top.
   * Default: the page's `<main>` scrolls to the top. A host whose list scrolls
   * in another container passes its own.
   */
  onApplied?: () => void;
}

const scrollMainToTop = () => document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });

export function useTagFilterModal({
  tags,
  deviceFilters,
  columns,
  setParams,
  onApplied = scrollMainToTop,
}: UseTagFilterModalParams) {
  // The content area's step, not the window's: the table header follows it, and a docked side panel narrows it while
  // the window stays wide.
  const breakpoint = useContentBreakpoint();
  const isMdUp = breakpoint === undefined ? undefined : breakpoint !== 'mobile';
  const [isOpen, setIsOpen] = useState(false);

  // FilterModal calls onFilterChange first, then onTagsChange.
  // We buffer column filters in a ref so onTagsChange can flush everything in one setParams call.
  const pendingFiltersRef = useRef<Record<string, string[]>>({});

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Below md the table draws no header, so every column filters here; on a desktop-width area only the columns whose
  // header has no funnel at that width do.
  const filterGroups = useMemo(
    () =>
      columns
        .filter(column => column.filterable && (!isMdUp || (breakpoint === 'desktop' && column.inWindowOnDesktop)))
        .map(column => ({
          id: column.key,
          title: column.label,
          options: column.filterOptions || [],
        })),
    [columns, isMdUp, breakpoint],
  );

  const tagFilterKeys = useMemo(() => {
    if (!deviceFilters?.tagKeys) return [];
    const grouped = new Map<string, { id: string; label: string; count?: number }[]>();
    for (const tag of deviceFilters.tagKeys) {
      if (tag.key === 'null') continue;
      const values = grouped.get(tag.key) ?? [];
      grouped.set(tag.key, values);
      if (tag.value !== 'null') {
        values.push({ id: tag.value, label: tag.value, count: tag.count });
      }
    }
    return Array.from(grouped, ([key, values]) => ({ key, label: key, values }));
  }, [deviceFilters]);

  // Step 1: buffer column filters (called first by FilterModal)
  const handleFilterChange = useCallback((columnFilters: Record<string, string[]>) => {
    pendingFiltersRef.current = columnFilters;
  }, []);

  // Only a host that draws the directory columns has the USER and SOURCES groups: another's list params stay untouched
  const hasDirectoryGroups = useMemo(() => columns.some(column => column.key === 'user'), [columns]);

  // Step 2: combine with buffered filters and flush (called second by FilterModal)
  const handleTagsChange = useCallback(
    (newTags: string[]) => {
      const cf = pendingFiltersRef.current;
      setParams({
        statuses: cf.status || [],
        osTypes: cf.os || [],
        organizationIds: cf.organization || [],
        // FilterModal drops a group with nothing ticked, so a missing group clears its param
        ...(hasDirectoryGroups && { userLinks: cf.user || [], directorySources: cf.sources || [] }),
        tags: newTags.filter(isCompleteTag),
      });
      pendingFiltersRef.current = {};
      onApplied();
    },
    [setParams, onApplied, hasDirectoryGroups],
  );

  return {
    isOpen,
    open,
    close,
    isMdUp,
    filterGroups,
    tagFilterKeys,
    handleFilterChange,
    handleTagsChange,
    selectedTags: tags,
  };
}
