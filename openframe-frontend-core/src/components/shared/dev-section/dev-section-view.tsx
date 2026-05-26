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
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from '../../../embed-shims';
import { SearchInput } from '../../ui';
import { StatusFilterComponent } from '../../features';
import {
  OPENFRAME_DEV_SECTIONS,
  type OpenframeDevSectionKey,
} from '../../../utils/dev-sections/openframe-dev-sections';

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
    description: string;
  };
  /** The page-specific list body. Reads URL params written by this
   *  component (search input + filter pills). */
  children: ReactNode;
}

export function DevSectionView({ sectionKey, hero, children }: DevSectionViewProps) {
  const section = OPENFRAME_DEV_SECTIONS[sectionKey];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = section.search;
  const filter = section.filter;

  const currentSearch = search ? searchParams.get(search.paramKey) || '' : '';
  const currentFilterValue = filter
    ? searchParams.get(filter.paramKey) || filter.defaultValue
    : '';

  // Controlled search-input state — input commits to the URL only on
  // Enter (not on every keystroke), preserving the legacy behavior.
  // Lazy init from URL avoids a brief flash of stale value on first
  // paint after URL-driven re-render (e.g. tab switch).
  const [searchValue, setSearchValue] = useState(() => currentSearch);
  useEffect(() => {
    setSearchValue(currentSearch);
  }, [currentSearch]);

  const handleSearchSubmit = (value: string) => {
    if (!search) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) params.set(search.paramKey, value.trim());
    else params.delete(search.paramKey);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleFilterChange = (value: string) => {
    if (!filter) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === filter.defaultValue) params.delete(filter.paramKey);
    else params.set(filter.paramKey, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="w-full flex flex-col gap-10">
      {hero ? (
        <div className="space-y-4">
          <h1 className="text-h1 tracking-[-1.12px] text-ods-text-primary flex items-center gap-3">
            {hero.icon}
            {section.hero.title}
          </h1>
          <p className="font-['DM_Sans'] font-medium text-[18px] leading-[28px] text-ods-text-secondary max-w-3xl">
            {hero.description}
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between w-full">
          <h2 className="font-['Azeret_Mono'] font-semibold text-[32px] md:text-[40px] lg:text-[48px] leading-[40px] md:leading-[48px] lg:leading-[56px] text-ods-text-primary tracking-[-0.64px] md:tracking-[-0.8px] lg:tracking-[-0.96px]">
            {section.hero.title}
            <span className="text-ods-accent">:</span>
          </h2>
        </div>
      )}

      {(search || filter) && (
        <div className="space-y-4">
          {search && (
            <SearchInput
              showDropdown={false}
              placeholder={search.placeholder}
              value={searchValue}
              onChange={setSearchValue}
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
