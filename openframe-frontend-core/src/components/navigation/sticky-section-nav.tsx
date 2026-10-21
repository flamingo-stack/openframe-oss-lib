'use client';

import type React from 'react';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from '../../embed-shims/next-link';
import { cn } from '../../utils';
import { scrollElementIntoView } from '../../utils/scroll-into-view';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from '../ui/loading-scope';
import { ScrollShadow } from '../ui/scroll-fade';

/** The bar's height, as a class and in px (the offset a page's anchors clear besides the header). */
export const STICKY_SECTION_NAV_HEIGHT_CLASS = 'h-14';
export const STICKY_SECTION_NAV_HEIGHT_PX = 56;

/** How many sections the skeleton draws when the sections are read with the page. */
export const STICKY_SECTION_NAV_SKELETON_COUNT = 5;

/** The bars' and rows' classes, read by the navigation and by its skeleton, so the skeleton is its size. */
const HORIZONTAL_NAV_CLASS = 'flex items-stretch gap-6 bg-ods-bg';
const HORIZONTAL_BRAND_CLASS =
  'hidden shrink-0 items-center gap-2.5 border-r border-ods-border pr-6 text-ods-text-primary text-h4 content-lg:flex';
const HORIZONTAL_ROW_CLASS = 'flex h-full items-center gap-1 [scrollbar-width:none] content-lg:items-stretch';
const HORIZONTAL_ACTION_CLASS = 'hidden shrink-0 items-center content-lg:flex';
/**
 * A section's pill on a narrow area; from the content `lg` step a tab the height of the bar. Its shape, read by the
 * pill and by its skeleton (the label a bar inside it), so the skeleton is the pill's size at every step.
 */
const PILL_CLASS = cn(
  'flex shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1.5 text-h6',
  'content-lg:rounded-none content-lg:border-x-0 content-lg:border-b-2 content-lg:border-t-0 content-lg:py-0',
);
const VERTICAL_NAV_CLASS = 'relative bg-ods-bg';
const VERTICAL_ROW_CLASS = 'relative flex h-10 w-full items-stretch transition-all duration-200';
const VERTICAL_BUTTON_CLASS = 'relative flex flex-1 cursor-pointer items-center gap-2 px-3 py-2';

export interface StickyNavSection {
  id: string;
  label: string;
}

interface StickySectionNavProps {
  sections: StickyNavSection[];
  activeSection: string;
  onSectionClick: (sectionId: string) => void;
  className?: string;
  ribbonPosition?: 'left' | 'right';
  ribbonColor?: string;
  /**
   * `vertical` (default): the table of contents beside a document.
   * `horizontal`: a bar across the page (stick it under the header with
   * `className`): `brand` at the start, the sections as a pill row that scrolls
   * sideways when it does not fit, `action` at the end.
   */
  orientation?: 'vertical' | 'horizontal';
  /** Horizontal only: what the bar belongs to (a product mark and name). Hidden on a narrow area. */
  brand?: React.ReactNode;
  /** Horizontal only: one link or button at the end of the bar. Hidden on a narrow area. */
  action?: React.ReactNode;
  /** Names the navigation for assistive tech. */
  label?: string;
}

function HorizontalSectionNav({
  sections,
  activeSection,
  onSectionClick,
  className,
  brand,
  action,
  label,
}: Omit<StickySectionNavProps, 'ribbonPosition' | 'ribbonColor' | 'orientation'>) {
  const navRef = useRef<HTMLElement>(null);
  // Keep the pill of the section being read in view when the row scrolls. The
  // row is the pill's parent: the lib's `ScrollShadow` owns the scrolling element.
  useEffect(() => {
    const pill = navRef.current?.querySelector<HTMLElement>(`[data-section="${CSS.escape(activeSection)}"]`);
    const row = pill?.parentElement;
    if (!row || !pill) return;
    const left = pill.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + pill.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: Math.max(0, left - 12), behavior: 'smooth' });
    }
  }, [activeSection]);

  return (
    <nav
      ref={navRef}
      aria-label={label}
      className={cn(HORIZONTAL_NAV_CLASS, STICKY_SECTION_NAV_HEIGHT_CLASS, className)}
    >
      {brand && <div className={HORIZONTAL_BRAND_CLASS}>{brand}</div>}
      {/* The scrolling row and its edge fades are the lib's one pattern (`ScrollShadow`), not a second one. */}
      <ScrollShadow axis="horizontal" className="min-w-0 flex-1" scrollClassName={HORIZONTAL_ROW_CLASS}>
        {sections.map(section => {
          const active = activeSection === section.id;
          return (
            <Link
              key={section.id}
              href={`#${section.id}`}
              data-section={section.id}
              aria-current={active ? 'location' : undefined}
              onClick={event => {
                event.preventDefault();
                onSectionClick(section.id);
              }}
              className={cn(
                PILL_CLASS,
                'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-accent',
                active
                  ? 'border-ods-border bg-ods-card text-ods-text-primary content-lg:border-ods-accent content-lg:bg-transparent content-lg:bg-gradient-to-b content-lg:from-transparent content-lg:to-ods-accent/10'
                  : 'border-transparent text-ods-text-secondary hover:text-ods-text-primary content-lg:hover:bg-ods-bg-hover',
              )}
            >
              {section.label}
            </Link>
          );
        })}
      </ScrollShadow>
      {action && <div className={HORIZONTAL_ACTION_CLASS}>{action}</div>}
    </nav>
  );
}

/**
 * Reusable sticky navigation component for section-based navigation
 * Used in vendor detail pages, knowledge base, documentation, etc.
 */
export function StickySectionNav({
  sections,
  activeSection,
  onSectionClick,
  className,
  ribbonPosition = 'left',
  ribbonColor = 'var(--color-accent-primary)',
  orientation = 'vertical',
  brand,
  action,
  label,
}: StickySectionNavProps) {
  // Sections that are read arrive empty in a page's loading state: the navigation is its skeleton. Sections a page
  // states itself are its own words and draw as they are.
  if (useLoadingScope() && sections.length === 0) {
    return (
      <StickySectionNavSkeleton
        orientation={orientation}
        brand={brand}
        action={action}
        ribbonPosition={ribbonPosition}
        className={className}
      />
    );
  }
  if (orientation === 'horizontal') {
    return (
      <HorizontalSectionNav
        sections={sections}
        activeSection={activeSection}
        onSectionClick={onSectionClick}
        className={className}
        brand={brand}
        action={action}
        label={label}
      />
    );
  }
  const navHeight = sections.length * 40; // 40px per item (h-10)

  return (
    <nav aria-label={label} className={cn(VERTICAL_NAV_CLASS, className)}>
      {/* Background gray vertical line for all nav items */}
      <div
        className="absolute bg-ods-border"
        style={{
          width: '1px',
          height: `${navHeight}px`,
          [ribbonPosition === 'left' ? 'left' : 'right']: '-2px',
          top: '0px',
        }}
      />

      {sections.map(section => (
        <div key={section.id} className={VERTICAL_ROW_CLASS}>
          {/* Yellow ribbon for active state */}
          {activeSection === section.id && (
            <div
              className="absolute z-10 transition-all duration-200"
              style={{
                backgroundColor: ribbonColor,
                width: '4px',
                height: '24px',
                [ribbonPosition === 'left' ? 'left' : 'right']: '-2px',
                top: '8px',
                borderRadius: '2px',
              }}
            />
          )}

          {/* Navigation button */}
          <button
            onClick={() => onSectionClick(section.id)}
            // The ribbon is the visual; this is the same state for assistive
            // tech (a table of contents marks the reader's current location).
            aria-current={activeSection === section.id ? 'location' : undefined}
            className={VERTICAL_BUTTON_CLASS}
          >
            <span
              className={cn(
                'text-left transition-all duration-200 text-h6',
                activeSection === section.id
                  ? 'text-ods-text-primary'
                  : 'text-ods-text-secondary hover:text-ods-text-primary',
              )}
            >
              {section.label}
            </span>
          </button>
        </div>
      ))}
    </nav>
  );
}

/** Bar widths for the skeleton's sections, fixed so the skeleton does not change between renders. */
const SKELETON_LABEL_WIDTHS = ['w-24', 'w-32', 'w-20', 'w-28', 'w-24'] as const;

/**
 * The section navigation while its sections are read: the same bar (horizontal: its brand and action as given,
 * the sections as pill boxes) or list (vertical: its rail, each row a bar of its label).
 */
export function StickySectionNavSkeleton({
  orientation = 'vertical',
  count = STICKY_SECTION_NAV_SKELETON_COUNT,
  brand,
  action,
  ribbonPosition = 'left',
  className,
}: Pick<StickySectionNavProps, 'orientation' | 'brand' | 'action' | 'ribbonPosition' | 'className'> & {
  count?: number;
}) {
  const widths = Array.from({ length: count }, (_, i) => SKELETON_LABEL_WIDTHS[i % SKELETON_LABEL_WIDTHS.length]);
  if (orientation === 'horizontal') {
    return (
      <div className={cn(HORIZONTAL_NAV_CLASS, STICKY_SECTION_NAV_HEIGHT_CLASS, className)} aria-hidden inert>
        {brand && <div className={HORIZONTAL_BRAND_CLASS}>{brand}</div>}
        <div className={cn('min-w-0 flex-1 overflow-hidden', HORIZONTAL_ROW_CLASS, 'content-lg:items-center')}>
          {widths.map((width, i) => (
            // The pill's own box (a tab from the content `lg` step), its label a bar.
            <div key={i} className={cn(PILL_CLASS, 'border-transparent')}>
              <TextLineSkeleton type="h6" className={width} />
            </div>
          ))}
        </div>
        {action && <div className={HORIZONTAL_ACTION_CLASS}>{action}</div>}
      </div>
    );
  }
  return (
    <div className={cn(VERTICAL_NAV_CLASS, className)} aria-hidden>
      <div
        className="absolute bg-ods-border"
        style={{
          width: '1px',
          height: `${count * 40}px`,
          [ribbonPosition === 'left' ? 'left' : 'right']: '-2px',
          top: '0px',
        }}
      />
      {widths.map((width, i) => (
        <div key={i} className={VERTICAL_ROW_CLASS}>
          <div className={VERTICAL_BUTTON_CLASS}>
            <TextLineSkeleton type="h6" className={width} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * SIMPLEST POSSIBLE IMPLEMENTATION - Just make it work
 */
export function useSectionNavigation(
  sections: { id: string; ref: React.RefObject<HTMLElement> }[],
  options?: {
    offset?: number;
  },
) {
  const [activeSection, setActiveSection] = useState(sections[0]?.id || '');
  const isScrollingFromClick = useRef(false);
  const { offset = 100 } = options || {};

  // Handle click - scroll to the element via the canonical helper.
  // The `offset` prop maps to `headerOffset` (sticky chrome above the
  // section nav); same smooth-scroll mechanics every other anchor
  // surface in the app uses.
  const handleSectionClick = useCallback(
    (sectionId: string) => {
      const targetElement = document.getElementById(sectionId);
      if (!targetElement) return;

      // Prevent scroll spy while we're scrolling
      isScrollingFromClick.current = true;
      setActiveSection(sectionId);

      scrollElementIntoView(targetElement, { headerOffset: offset });

      // Allow scroll spy again after scroll completes
      setTimeout(() => {
        isScrollingFromClick.current = false;
      }, 500);
    },
    [offset],
  );

  // Make sure elements have IDs
  useEffect(() => {
    sections.forEach(section => {
      const el = section.ref.current;
      if (el && !el.id) {
        el.id = section.id;
      }
    });
  }, [sections]);

  // Simple scroll spy
  useEffect(() => {
    const handleScroll = () => {
      if (isScrollingFromClick.current) return;

      const scrollPosition = window.scrollY + offset + 50;

      // Find which section we're in
      let currentSection = sections[0]?.id || '';

      for (let i = sections.length - 1; i >= 0; i--) {
        const element = document.getElementById(sections[i].id);
        if (element && scrollPosition >= element.offsetTop) {
          currentSection = sections[i].id;
          break;
        }
      }

      setActiveSection(currentSection);
    };

    // Throttle the scroll handler
    let scrollTimer: NodeJS.Timeout;
    const throttledScroll = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(handleScroll, 100);
    };

    window.addEventListener('scroll', throttledScroll);
    handleScroll(); // Check initial position

    return () => {
      window.removeEventListener('scroll', throttledScroll);
      clearTimeout(scrollTimer);
    };
  }, [sections, offset]);

  return {
    activeSection,
    handleSectionClick,
  };
}
