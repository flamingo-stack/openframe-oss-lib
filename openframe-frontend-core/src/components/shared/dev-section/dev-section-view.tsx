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
import { SearchInput } from '../../ui';

export interface DevSectionViewProps {
  /** Which section to render — drives title, search, and filter
   *  config via the `OPENFRAME_DEV_SECTIONS` registry. */
  sectionKey: OpenframeDevSectionKey;
  /** When set, renders the rich page-level hero (icon + h1 + description).
   *  Omit for the compact tab-context heading. */
  hero?: {
    /** Pre-rendered icon JSX. Server components render the icon themselves
     *  and pass the element here — function references can't cross the
     *  server→client boundary, but React elements can. */
    icon: ReactNode;
    /** Hero title. Falls back to `OPENFRAME_DEV_SECTIONS[sectionKey].hero.title`
     *  when omitted, so embedders can override the (OpenFrame-specific) default
     *  copy without forking the registry. */
    title?: string;
    description: string;
  };
  /** Optional slot rendered BETWEEN the hero and the search/filter
   *  controls. Use this for an entry-action surface that should sit
   *  above the list (e.g. the Help Center's "Open a new ticket" form).
   *  The slot is wrapped in the same `gap-10` flex column so spacing
   *  matches the surrounding chrome — callers should NOT add their
   *  own top/bottom margin. Renders `null` (no DOM) when omitted. */
  preControls?: ReactNode;
  /** The page-specific list body. Reads URL params written by this
   *  component (search input + filter pills). */
  children: ReactNode;
  /** Render this component's own title heading (hero or compact `h2`). Default
   *  `true` — the tab context renders the compact heading itself. Pass `false`
   *  when the host already renders the title elsewhere (e.g. `DevSectionPage`
   *  routes it through the unified `PageLayout` `TitleBlock`): then only the
   *  search + filter controls + list render, with no duplicate heading. */
  showHeading?: boolean;
}

export function DevSectionView({ sectionKey, hero, preControls, children, showHeading = true }: DevSectionViewProps) {
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

  return (
    <div className="flex w-full flex-col gap-10">
      {showHeading &&
        (hero ? (
          <div className="space-y-4">
            <h1 className="flex items-center gap-3 tracking-[-1.12px] text-ods-text-primary text-h1">
              {hero.icon}
              {hero.title ?? section.hero.title}
            </h1>
            <p className="max-w-3xl text-ods-text-secondary text-h4">{hero.description}</p>
          </div>
        ) : (
          <div className="flex w-full items-center justify-between">
            <h2 className="font-['Azeret_Mono'] text-[32px] font-semibold leading-[40px] tracking-[-0.64px] text-ods-text-primary md:text-[40px] md:leading-[48px] md:tracking-[-0.8px] lg:text-[48px] lg:leading-[56px] lg:tracking-[-0.96px]">
              {section.hero.title}
              <span className="text-ods-accent">:</span>
            </h2>
          </div>
        ))}

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
  );
}
