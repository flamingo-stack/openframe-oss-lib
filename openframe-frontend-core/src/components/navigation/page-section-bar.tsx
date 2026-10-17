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
 * A tab is shown only for a section that RENDERED: a section that leaves itself
 * out (its anchor element empty, e.g. a list with no rows) loses its tab, also
 * when that happens after a client read (`useRenderedSections`). A page puts
 * `PAGE_ANCHOR_SCOPE_CLASS` on its `<main>` so every anchor clears the header and
 * the bar when a link lands on it.
 */
import { type ReactNode, useEffect, useState } from 'react';
import { useHeaderHeight } from '../../hooks/ui/use-header-height';
import { cn } from '../../utils/cn';
import { NavLinkAnchorViaRuntime } from '../chat/nav-link-anchor-via-runtime';
import { useScrollSpy } from '../docs/use-scroll-spy';
import { PageContainer } from '../layout/page-container';
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
/** The bar's side insets: the page sections' own (the width is `PageContainer`'s). */
const SECTION_BAR_INSET_CLASS = 'px-[var(--spacing-system-lf)] md:px-20';

/**
 * The sections whose anchor element holds something. Every section counts until
 * the page has mounted (the server's HTML and the first render agree); then a
 * section whose element is missing or empty is left out, and each element is
 * watched, so a section that removes itself after a client read loses its tab.
 */
function useRenderedSections(sections: StickyNavSection[]): StickyNavSection[] {
  const [empty, setEmpty] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const measure = () =>
      setEmpty(prev => {
        const next = new Set(sections.filter(section => !document.getElementById(section.id)?.hasChildNodes()).map(s => s.id));
        return next.size === prev.size && [...next].every(id => prev.has(id)) ? prev : next;
      });
    measure();
    const observer = new MutationObserver(measure);
    for (const section of sections) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element, { childList: true });
    }
    return () => observer.disconnect();
  }, [sections]);
  return empty.size === 0 ? sections : sections.filter(section => !empty.has(section.id));
}

export interface PageSectionBarProps {
  /** The sections on the page, in page order. A stable array while the set is (the spy re-binds on a new one). */
  sections: StickyNavSection[];
  /** The bar's accessible name. */
  label?: string;
  /** Before the tabs (a product's mark and name). */
  brand?: ReactNode;
  /**
   * A link after the tabs (a product page's "pricing"): the site's one link (the
   * unified nav rule); a same-page `#id` scrolls the way the tabs do (the bar's
   * own scroll, with the header's live offset).
   */
  action?: { label: ReactNode; href: string; className?: string };
}

export function PageSectionBar({ sections: listed, label, brand, action }: PageSectionBarProps) {
  const sections = useRenderedSections(listed);
  // What stays stuck over the bar: the site header alone, and nothing while it has slid away.
  const headerBottom = useHeaderHeight(undefined, { stuckOnly: true });
  const { activeSection, handleSectionClick } = useScrollSpy(sections, {
    syncHash: true,
    aboveFirst: 'none',
    headerOffset: headerBottom + SECTION_BAR_HEIGHT_PX + PAGE_ANCHOR_GAP_PX,
  });
  if (sections.length === 0) return null;

  return (
    <PageContainer
      as="div"
      backgroundClassName="sticky z-30 border-b border-ods-border bg-ods-bg transition-[top] duration-300 ease-in-out motion-reduce:transition-none"
      backgroundStyle={{ top: headerBottom }}
      contentPadding={SECTION_BAR_INSET_CLASS}
    >
      <StickySectionNav
        orientation="horizontal"
        label={label}
        sections={sections}
        activeSection={activeSection}
        onSectionClick={handleSectionClick}
        brand={brand}
        action={
          action && (
            <NavLinkAnchorViaRuntime
              href={action.href}
              // A same-page `#id` lands like a tab does: the bar's own scroll, with the header's live offset.
              onClick={event => {
                if (!action.href.startsWith('#')) return;
                event.preventDefault();
                handleSectionClick(action.href.slice(1));
              }}
              className={cn('whitespace-nowrap text-h6 hover:underline', action.className)}
            >
              {action.label}
            </NavLinkAnchorViaRuntime>
          )
        }
      />
    </PageContainer>
  );
}
