'use client';

/**
 * DevSectionView — the canonical chrome for ANY dev-center section
 * (Roadmap / Delivery / Releases). One component, used in BOTH:
 *
 *   - tabbed `/roadmap-and-releases` (compact title mode, no `hero`)
 *   - full-page `/roadmap`, `/bug-fixes-and-enhancements`, `/releases`
 *     (hero mode with icon + description + back link)
 *
 * Owns: title rendering, the inline search input, the filter pill row,
 * and the URL-param wiring that connects both. The list `children`
 * receive a clean URL contract — they read `?<paramKey>=...` via
 * `useSearchParams()` and refetch on change. No duplicated controls.
 */

import type { ReactNode } from 'react';
import { useState } from 'react';
import { useRouter, useSearchParams, usePathname } from '../../../embed-shims';
import {
  OPENFRAME_DEV_SECTIONS,
  type OpenframeDevSection,
  type OpenframeDevSectionKey,
} from '../../../utils/dev-sections/openframe-dev-sections';
import { StatusFilterComponent } from '../../features';
import { PageDataSyncProvider, PageDataSyncRow } from '../../layout/page-data-sync';
import { SectionHeading } from '../../layout/page-heading';
import { SearchInput } from '../../ui';

export interface DevSectionViewProps {
  /** Which section to render — drives title, search, and filter
   *  config via the `OPENFRAME_DEV_SECTIONS` registry. */
  sectionKey: OpenframeDevSectionKey;
  /** Optional slot rendered BETWEEN the heading and the search/filter
   *  controls. Use this for an entry-action surface that should sit
   *  above the list (e.g. the Help Center's "Open a new ticket" form).
   *  The slot is wrapped in the same `gap-10` flex column so spacing
   *  matches the surrounding chrome — callers should NOT add their
   *  own top/bottom margin. Renders `null` (no DOM) when omitted. */
  preControls?: ReactNode;
  /** The page-specific list body. Reads URL params written by this
   *  component (search input + filter pills). */
  children: ReactNode;
  /** Render this component's own title heading (the section's `h2`). Default
   *  `true` — the tab context renders the compact heading itself. Pass `false`
   *  when the host already renders the title elsewhere (e.g. `DevSectionPage`
   *  routes it through the unified `PageLayout` `TitleBlock`): then only the
   *  search + filter controls + list render, with no duplicate heading. */
  showHeading?: boolean;
}

export function DevSectionView({ sectionKey, preControls, children, showHeading = true }: DevSectionViewProps) {
  const section = OPENFRAME_DEV_SECTIONS[sectionKey];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Widen from the registry's per-section literal types to the interface —
  // optional fields (`clearParamKeys`) exist on the interface but not on
  // every section's inferred literal. Sound: the registry `satisfies`
  // `Record<string, OpenframeDevSection>`.
  const search: OpenframeDevSection['search'] = section.search;
  const filter = section.filter;

  const currentSearch = search ? searchParams.get(search.paramKey) || '' : '';
  const currentFilterValue = filter ? searchParams.get(filter.paramKey) || filter.defaultValue : '';

  // Controlled search-input state — TYPING commits to the URL only on
  // Enter (not on every keystroke), but CLEARING commits immediately:
  // an emptied input must not keep filtering the list (the URL param —
  // and any linked `clearParamKeys` companion like the tickets
  // `?ticket=` drawer param — previously survived until Enter).
  // Lazy init from URL avoids a brief flash of stale value on first
  // paint after URL-driven re-render (e.g. tab switch).
  const [searchValue, setSearchValue] = useState(() => currentSearch);
  // Re-sync when the URL changes underneath us (tab switch, back/forward,
  // a companion param cleared elsewhere). Adjusted while rendering — React's
  // documented prop-sync pattern — rather than from an effect, which would
  // commit one frame with the input still showing the previous section's
  // query before replacing it.
  const [syncedSearch, setSyncedSearch] = useState(currentSearch);
  if (syncedSearch !== currentSearch) {
    setSyncedSearch(currentSearch);
    setSearchValue(currentSearch);
  }

  const handleSearchSubmit = (value: string) => {
    if (!search) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set(search.paramKey, value.trim());
    } else {
      params.delete(search.paramKey);
      // Empty commit tears down the search's linked companion params too
      // (deep links set them TOGETHER — see the config field docs).
      for (const key of search.clearParamKeys ?? []) params.delete(key);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (value === '' && currentSearch !== '') handleSearchSubmit('');
  };

  const handleFilterChange = (value: string) => {
    if (!filter) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === filter.defaultValue) params.delete(filter.paramKey);
    else params.set(filter.paramKey, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // The list reports where its records are mirrored from; the line states it at the end of the section's heading row
  // (under the page's title when this view shows no heading of its own).
  return (
    <PageDataSyncProvider>
      <div className="flex w-full flex-col gap-10">
        {showHeading ? (
          <SectionHeading title={section.hero.title} punctuation=":" action={<PageDataSyncRow inline />} />
        ) : (
          <PageDataSyncRow />
        )}

        {preControls}

        {(search || filter) && (
          <div className="space-y-4">
            {search && (
              <SearchInput
                showDropdown={false}
                placeholder={search.placeholder}
                value={searchValue}
                onChange={handleSearchChange}
                onSubmit={handleSearchSubmit}
              />
            )}
            {filter && (
              <StatusFilterComponent
                selectedStatus={currentFilterValue}
                onStatusChange={handleFilterChange}
                statusOptions={[...filter.options]}
              />
            )}
          </div>
        )}

        {children}
      </div>
    </PageDataSyncProvider>
  );
}
