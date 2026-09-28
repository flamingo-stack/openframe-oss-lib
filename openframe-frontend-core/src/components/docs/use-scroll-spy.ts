'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { scrollElementIntoView } from '../../utils/scroll-into-view';

// Single source for the sticky-chrome height. Used for BOTH the scroll target
// offset (where a clicked section lands) AND the active-section detection
// threshold (where the scroll listener flips highlight). They must match —
// previously 100 vs 150 caused a 50px window where the indicator jumped to
// the next section even though that section's top was still below the
// clicked one's resting offset.
const SCROLL_OFFSET = 100;

// Separator for the section-id key. A newline cannot occur inside an HTML id,
// so the join is unambiguous and the key can be split back apart.
const ID_SEPARATOR = '\n';

interface ScrollSpySection {
  id: string;
  title?: string;
  level?: number;
}

export interface UseScrollSpyOptions {
  /**
   * Keep the URL's `#hash` on the section being read as the user SCROLLS
   * (`replaceState`: no history entry, and no `hashchange`, so
   * `useScrollToHash` never re-scrolls to it). Above the first section the hash
   * is cleared. Only a scroll writes it — mounting a page never adds a hash.
   */
  syncHash?: boolean;
}

/** Point the URL's hash at `sectionId` (or clear it) without a history entry or a `hashchange`. */
function replaceHash(sectionId: string | null): void {
  const { pathname, search, hash } = window.location;
  const next = sectionId ? `#${sectionId}` : '';
  if (hash === next) return;
  window.history.replaceState(window.history.state, '', `${pathname}${search}${next}`);
}

interface UseScrollSpyReturn {
  activeSection: string;
  handleSectionClick: (sectionId: string) => void;
}

/**
 * Shared scroll spy hook for tracking active section based on scroll position.
 * Used by DocViewer for sticky section navigation.
 */
export function useScrollSpy(
  sections: ScrollSpySection[] | undefined,
  options: UseScrollSpyOptions = {},
): UseScrollSpyReturn {
  const { syncHash = false } = options;
  const [activeSection, setActiveSection] = useState('');
  const isScrollingFromClick = useRef(false);

  // The scroll listener only ever needs the section IDS, and callers rebuild
  // the `sections` array on every render — so the value-stable joined key IS
  // the input, and the effect unpacks it again. That replaces a ref written
  // during render whose only job was to keep the array's churning identity out
  // of the dependency array.
  const sectionIdsKey = useMemo(() => sections?.map(s => s.id).join(ID_SEPARATOR) ?? '', [sections]);

  const handleSectionClick = useCallback((sectionId: string) => {
    const targetElement = document.getElementById(sectionId);
    if (!targetElement) return;

    isScrollingFromClick.current = true;
    setActiveSection(sectionId);

    scrollElementIntoView(targetElement, { headerOffset: SCROLL_OFFSET });

    setTimeout(() => {
      isScrollingFromClick.current = false;
    }, 800);
  }, []);

  useEffect(() => {
    const sectionIds = sectionIdsKey === '' ? [] : sectionIdsKey.split(ID_SEPARATOR);
    if (sectionIds.length === 0) return undefined;

    // `fromScroll`: a real scroll settled (not the mount-time pass).
    const handleScroll = (fromScroll = false) => {
      if (isScrollingFromClick.current) return;

      const scrollPosition = window.scrollY + SCROLL_OFFSET;
      let currentSection = sectionIds[0] ?? '';

      // At the bottom of the page the last sections can never reach the offset
      // line, so they would never highlight: the last one wins there. Only on a
      // page that actually SCROLLS — a short page is "at the bottom" at
      // scrollY 0, which would otherwise highlight the last section on load.
      const { scrollHeight } = document.documentElement;
      const scrollable = scrollHeight > window.innerHeight + 2;
      const atBottom = scrollable && window.innerHeight + window.scrollY >= scrollHeight - 2;
      if (atBottom) {
        currentSection = sectionIds[sectionIds.length - 1] ?? currentSection;
      } else {
        for (let i = sectionIds.length - 1; i >= 0; i--) {
          const element = document.getElementById(sectionIds[i]);
          // Document-absolute top: `offsetTop` is relative to the nearest
          // POSITIONED ancestor, which is not the document inside most layouts.
          if (element && scrollPosition >= element.getBoundingClientRect().top + window.scrollY) {
            currentSection = sectionIds[i];
            break;
          }
        }
      }

      setActiveSection(prev => (prev !== currentSection ? currentSection : prev));

      if (syncHash && fromScroll) {
        const first = document.getElementById(sectionIds[0] ?? '');
        const aboveFirst =
          !atBottom && first !== null && scrollPosition < first.getBoundingClientRect().top + window.scrollY;
        replaceHash(aboveFirst ? null : currentSection);
      }
    };

    let scrollTimer: ReturnType<typeof setTimeout>;
    const throttledScroll = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => handleScroll(true), 100);
    };

    window.addEventListener('scroll', throttledScroll);
    handleScroll();

    return () => {
      window.removeEventListener('scroll', throttledScroll);
      clearTimeout(scrollTimer);
    };
  }, [sectionIdsKey, syncHash]);

  return { activeSection, handleSectionClick };
}
