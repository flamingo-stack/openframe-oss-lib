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

interface UseScrollSpyReturn {
  activeSection: string;
  handleSectionClick: (sectionId: string) => void;
}

/**
 * Shared scroll spy hook for tracking active section based on scroll position.
 * Used by DocViewer for sticky section navigation.
 */
export function useScrollSpy(sections: ScrollSpySection[] | undefined): UseScrollSpyReturn {
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

    const handleScroll = () => {
      if (isScrollingFromClick.current) return;

      const scrollPosition = window.scrollY + SCROLL_OFFSET;
      let currentSection = sectionIds[0] ?? '';

      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const element = document.getElementById(sectionIds[i]);
        if (element && scrollPosition >= element.offsetTop) {
          currentSection = sectionIds[i];
          break;
        }
      }

      setActiveSection(prev => (prev !== currentSection ? currentSection : prev));
    };

    let scrollTimer: ReturnType<typeof setTimeout>;
    const throttledScroll = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(handleScroll, 100);
    };

    window.addEventListener('scroll', throttledScroll);
    handleScroll();

    return () => {
      window.removeEventListener('scroll', throttledScroll);
      clearTimeout(scrollTimer);
    };
  }, [sectionIdsKey]);

  return { activeSection, handleSectionClick };
}
