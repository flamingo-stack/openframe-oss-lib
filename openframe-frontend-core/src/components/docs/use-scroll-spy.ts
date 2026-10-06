'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { getScrollableAncestor, scrollElementIntoView } from '../../utils/scroll-into-view';

// Default sticky-chrome height. Used for BOTH the scroll target offset (where a
// clicked section lands) AND the active-section detection threshold (where the
// scroll listener flips highlight). They must match — previously 100 vs 150
// caused a 50px window where the indicator jumped to the next section even
// though that section's top was still below the clicked one's resting offset.
// `headerOffset` overrides both at once, so they cannot drift apart.
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
   * Keep the URL's `#hash` on the section being read (`replaceState`: no
   * history entry, and no `hashchange`, so `useScrollToHash` never re-scrolls
   * to it) — as the user SCROLLS, and when a rail click scrolls for them.
   * Above the first section the hash is cleared. Only a scroll or a click
   * writes it — mounting a page never adds a hash.
   */
  syncHash?: boolean;
  /**
   * Sticky-chrome height in px: where a clicked section lands AND the line a
   * section's top must pass to become the active one. One number for both, so
   * the highlight agrees with where the click put the section. Default 100.
   */
  headerOffset?: number;
}

/** Point the URL's hash at `sectionId` (or clear it) without a history entry or a `hashchange`. */
function replaceHash(sectionId: string | null): void {
  const { pathname, search, hash } = window.location;
  const next = sectionId ? `#${sectionId}` : '';
  if (hash === next) return;
  window.history.replaceState(window.history.state, '', `${pathname}${search}${next}`);
}

/**
 * The thing that scrolls the sections: the nearest real scroll container
 * around them, or the window. Reads are routed through it so the same
 * arithmetic serves both — the window is just the scroller whose visible area
 * starts at viewport y = 0.
 */
interface Scroller {
  target: HTMLElement | Window;
  scrollTop: () => number;
  /** Where the scroller's visible area starts, in viewport coordinates. */
  viewportTop: () => number;
  clientHeight: () => number;
  scrollHeight: () => number;
}

/**
 * Resolve the scroller from the first section, with the SAME rule
 * `scrollElementIntoView` uses to pick where it scrolls (`getScrollableAncestor`).
 * App shells that put page content in a fixed-height `<main overflow-y-auto>`
 * (OpenFrame's `AppLayout`) never scroll the window: a window-bound spy there
 * sees `scrollY` 0 forever and never gets a `scroll` event, so the first
 * section stayed highlighted whatever was on screen. No such ancestor (a plain
 * page, or the sections not rendered yet) → the window, as before.
 */
function resolveScroller(firstSection: HTMLElement | null): Scroller {
  const container = firstSection ? getScrollableAncestor(firstSection) : null;
  if (container) {
    return {
      target: container,
      scrollTop: () => container.scrollTop,
      viewportTop: () => container.getBoundingClientRect().top,
      clientHeight: () => container.clientHeight,
      scrollHeight: () => container.scrollHeight,
    };
  }
  return {
    target: window,
    scrollTop: () => window.scrollY,
    viewportTop: () => 0,
    clientHeight: () => window.innerHeight,
    scrollHeight: () => document.documentElement.scrollHeight,
  };
}

interface UseScrollSpyReturn {
  activeSection: string;
  handleSectionClick: (sectionId: string) => void;
}

/**
 * Shared scroll spy hook for tracking active section based on scroll position.
 * Used by DocViewer and TrustCenterPage for sticky section navigation.
 *
 * Listens to whatever actually scrolls the sections — the nearest scroll
 * container, else the window (see `resolveScroller`) — and measures section
 * tops in that scroller's own coordinates, which is exactly how
 * `scrollElementIntoView` computes the target of a click.
 */
export function useScrollSpy(
  sections: ScrollSpySection[] | undefined,
  options: UseScrollSpyOptions = {},
): UseScrollSpyReturn {
  const { syncHash = false, headerOffset = SCROLL_OFFSET } = options;
  const [activeSection, setActiveSection] = useState('');
  const isScrollingFromClick = useRef(false);

  // The scroll listener only ever needs the section IDS, and callers rebuild
  // the `sections` array on every render — so the value-stable joined key IS
  // the input, and the effect unpacks it again. That replaces a ref written
  // during render whose only job was to keep the array's churning identity out
  // of the dependency array.
  const sectionIdsKey = useMemo(() => sections?.map(s => s.id).join(ID_SEPARATOR) ?? '', [sections]);

  const handleSectionClick = useCallback(
    (sectionId: string) => {
      const targetElement = document.getElementById(sectionId);
      if (!targetElement) return;

      isScrollingFromClick.current = true;
      setActiveSection(sectionId);
      // The click IS the reader's position now: say so in the URL right away
      // rather than waiting for a scroll event the click guard below swallows.
      if (syncHash) replaceHash(sectionId);

      scrollElementIntoView(targetElement, { headerOffset });

      setTimeout(() => {
        isScrollingFromClick.current = false;
      }, 800);
    },
    [syncHash, headerOffset],
  );

  useEffect(() => {
    const sectionIds = sectionIdsKey === '' ? [] : sectionIdsKey.split(ID_SEPARATOR);
    if (sectionIds.length === 0) return undefined;

    // Pick the scroller ONCE per section set, like `scrollElementIntoView` does
    // per call: the sections and their container render together, so the
    // effect sees the final layout.
    const scroller = resolveScroller(document.getElementById(sectionIds[0] ?? ''));

    // `fromScroll`: a real scroll settled (not the mount-time pass).
    const handleScroll = (fromScroll = false) => {
      if (isScrollingFromClick.current) return;

      const scrollTop = scroller.scrollTop();
      const viewportTop = scroller.viewportTop();
      const scrollPosition = scrollTop + headerOffset;
      // A section's top in the scroller's coordinates. `offsetTop` is relative
      // to the nearest POSITIONED ancestor, which is neither the document nor
      // the scroll container inside most layouts — measure from the viewport
      // and translate.
      const sectionTop = (element: HTMLElement) => element.getBoundingClientRect().top - viewportTop + scrollTop;
      let currentSection = sectionIds[0] ?? '';

      // At the bottom of the page the last sections can never reach the offset
      // line, so they would never highlight: the last one wins there. Only on a
      // page that actually SCROLLS — a short page is "at the bottom" at
      // scrollTop 0, which would otherwise highlight the last section on load.
      const scrollHeight = scroller.scrollHeight();
      const clientHeight = scroller.clientHeight();
      const scrollable = scrollHeight > clientHeight + 2;
      const atBottom = scrollable && clientHeight + scrollTop >= scrollHeight - 2;
      if (atBottom) {
        currentSection = sectionIds[sectionIds.length - 1] ?? currentSection;
      } else {
        for (let i = sectionIds.length - 1; i >= 0; i--) {
          const element = document.getElementById(sectionIds[i]);
          if (element && scrollPosition >= sectionTop(element)) {
            currentSection = sectionIds[i];
            break;
          }
        }
      }

      setActiveSection(prev => (prev !== currentSection ? currentSection : prev));

      if (syncHash && fromScroll) {
        const first = document.getElementById(sectionIds[0] ?? '');
        const aboveFirst = !atBottom && first !== null && scrollPosition < sectionTop(first);
        replaceHash(aboveFirst ? null : currentSection);
      }
    };

    let scrollTimer: ReturnType<typeof setTimeout>;
    const throttledScroll = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => handleScroll(true), 100);
    };

    scroller.target.addEventListener('scroll', throttledScroll);
    handleScroll();

    return () => {
      scroller.target.removeEventListener('scroll', throttledScroll);
      clearTimeout(scrollTimer);
    };
  }, [sectionIdsKey, syncHash, headerOffset]);

  return { activeSection, handleSectionClick };
}
