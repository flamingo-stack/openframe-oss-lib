'use client';

import type React from 'react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { cn } from '../../utils';
import { scrollElementIntoView } from '../../utils/scroll-into-view';

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
  const rowRef = useRef<HTMLDivElement>(null);
  // Keep the pill of the section being read in view when the row scrolls.
  useEffect(() => {
    const row = rowRef.current;
    const pill = row?.querySelector<HTMLElement>(`[data-section="${CSS.escape(activeSection)}"]`);
    if (!row || !pill) return;
    const left = pill.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + pill.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: Math.max(0, left - 12), behavior: 'smooth' });
    }
  }, [activeSection]);

  return (
    <nav
      aria-label={label}
      className={cn('flex h-14 items-center gap-6 border-b border-ods-border bg-ods-bg', className)}
    >
      {brand && (
        <div className="hidden shrink-0 items-center gap-2 text-ods-text-primary text-h5 content-lg:flex">{brand}</div>
      )}
      <div ref={rowRef} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        {sections.map(section => {
          const active = activeSection === section.id;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              data-section={section.id}
              aria-current={active ? 'location' : undefined}
              onClick={event => {
                event.preventDefault();
                onSectionClick(section.id);
              }}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 transition-colors text-h6',
                active ? 'bg-ods-card text-ods-text-primary' : 'text-ods-text-secondary hover:text-ods-text-primary',
              )}
            >
              {section.label}
            </a>
          );
        })}
      </div>
      {action && <div className="hidden shrink-0 content-lg:block">{action}</div>}
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
    <nav aria-label={label} className={cn('relative bg-ods-bg', className)}>
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
        <div key={section.id} className="relative flex h-10 w-full items-stretch transition-all duration-200">
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
            className="relative flex flex-1 cursor-pointer items-center gap-2 px-3 py-2"
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
