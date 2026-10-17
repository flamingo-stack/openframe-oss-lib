'use client';

/**
 * THE bar that follows the reader down a long page: its sections as tabs, the
 * one being read marked. A full-width band stuck directly under the site header
 * (`useHeaderHeight` with `stuckOnly`: the header alone, never the announcement
 * bar, which scrolls away), its content on the page's gutters. `StickySectionNav`
 * owns its look; `useScrollSpy` says which section is being read and keeps the
 * URL's hash on it (`syncHash`), so a reload stays where the reader was, and
 * above the first section (the hero) nothing is active and the URL has no hash.
 *
 * A page lists only the sections that RENDERED, and puts `PAGE_ANCHOR_SCOPE_CLASS`
 * on its `<main>` so every anchor clears the header and the bar when a link
 * lands on it.
 */
import type { ReactNode } from 'react';
import { useHeaderHeight } from '../../hooks/ui/use-header-height';
import { cn } from '../../utils/cn';
import { NavLinkAnchorViaRuntime } from '../chat/nav-link-anchor-via-runtime';
import { useScrollSpy } from '../docs/use-scroll-spy';
import { StickySectionNav, type StickyNavSection } from './sticky-section-nav';

/** The bar's own height (`StickySectionNav`'s `h-14`): what a section's anchor must clear besides the header. */
export const SECTION_BAR_HEIGHT_PX = 56;
/**
 * What a section clears when a link lands on it: the site header (72px), this
 * bar (56px) and a breath. The CSS twin of the offset the bar's tabs scroll by.
 */
export const PAGE_ANCHOR_SCROLL_MARGIN_CLASS = 'scroll-mt-36';
/** The same margin for every anchored element under a page's `<main>` (sections, cards, tabs). */
export const PAGE_ANCHOR_SCOPE_CLASS = '[&_[id]]:scroll-mt-36';
/** The breath between the bars and the heading a link lands on. */
export const PAGE_ANCHOR_GAP_PX = 16;
/** The bar's gutters: the page sections' own. */
const SECTION_BAR_GUTTER_CLASS = 'mx-auto w-full max-w-[1920px] px-[var(--spacing-system-lf)] md:px-20';

export interface PageSectionBarProps {
  /** The sections on the page, in page order. A stable array while the set is (the spy re-binds on a new one). */
  sections: StickyNavSection[];
  /** The bar's accessible name. */
  label?: string;
  /** Before the tabs (a product's mark and name). */
  brand?: ReactNode;
  /**
   * A link after the tabs (a product page's "pricing"): the site's one link (the
   * unified nav rule), so a same-page `#id` takes the site's anchor scroll and
   * lands under the bars like a tab does (`PAGE_ANCHOR_SCOPE_CLASS`).
   */
  action?: { label: ReactNode; href: string; className?: string };
}

export function PageSectionBar({ sections, label, brand, action }: PageSectionBarProps) {
  // What stays stuck over the bar: the site header alone, and nothing while it has slid away.
  const headerBottom = useHeaderHeight(undefined, { stuckOnly: true });
  const { activeSection, handleSectionClick } = useScrollSpy(sections, {
    syncHash: true,
    aboveFirst: 'none',
    headerOffset: headerBottom + SECTION_BAR_HEIGHT_PX + PAGE_ANCHOR_GAP_PX,
  });
  if (sections.length === 0) return null;

  return (
    <div
      className="sticky z-30 w-full border-b border-ods-border bg-ods-bg transition-[top] duration-300 ease-in-out motion-reduce:transition-none"
      style={{ top: headerBottom }}
    >
      <div className={SECTION_BAR_GUTTER_CLASS}>
        <StickySectionNav
          orientation="horizontal"
          label={label}
          sections={sections}
          activeSection={activeSection}
          onSectionClick={handleSectionClick}
          brand={brand}
          action={
            action && (
              <NavLinkAnchorViaRuntime href={action.href} className={cn('whitespace-nowrap text-h6 hover:underline', action.className)}>
                {action.label}
              </NavLinkAnchorViaRuntime>
            )
          }
        />
      </div>
    </div>
  );
}
