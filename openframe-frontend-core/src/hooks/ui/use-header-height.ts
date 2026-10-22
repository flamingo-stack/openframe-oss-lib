'use client';

import { useEffect, useState } from 'react';

/** The site header's own element (`SiteHeader`'s hook point). */
const SITE_HEADER_SELECTOR = '[data-site-header]';

/**
 * Returns the combined height (px) of the sticky page header and announcement
 * bar (if present), updated live via ResizeObserver / MutationObserver.
 * Useful for offsetting fixed/absolute-positioned panels so they don't
 * overlap the header.
 *
 * With `stuckOnly` it answers a different question: where the header's bottom
 * edge sits once the page has scrolled, the `top` of anything that sticks
 * directly under it. That is the site header ALONE (the announcement bar
 * scrolls away with the page, so adding it leaves a gap the content shows
 * through), and 0 while the header has slid itself out of view.
 */
export function useHeaderHeight(
  // First-paint fallback = the unified top-navigation `big` bar (72px), the
  // size every hub/marketing site renders; replaced by the live measurement.
  defaultHeight = 72,
  options: {
    /**
     * When false, no observers are attached and the default height is
     * returned — for consumers that stay mounted on every page but only need
     * the measurement while an overlay is open (avoids an always-on
     * document-wide MutationObserver + forced reflow).
     * @default true
     */
    enabled?: boolean;
    /**
     * Measure only what stays stuck to the top of a scrolled page: the site
     * header, without the announcement bar, and 0 while the header is hidden.
     * @default false
     */
    stuckOnly?: boolean;
  } = {},
): number {
  const { enabled = true, stuckOnly = false } = options;
  const [height, setHeight] = useState(defaultHeight);

  useEffect(() => {
    if (!enabled) return undefined;

    if (stuckOnly) {
      let stop: (() => void) | undefined;
      const watch = (header: HTMLElement) => {
        // The header hides by translating itself up by its own height.
        const measureStuck = () => setHeight(header.style.transform.includes('-100%') ? 0 : header.offsetHeight);
        measureStuck();
        const resize = new ResizeObserver(measureStuck);
        resize.observe(header);
        const mutation = new MutationObserver(measureStuck);
        mutation.observe(header, { attributes: true, attributeFilter: ['style'] });
        stop = () => {
          resize.disconnect();
          mutation.disconnect();
        };
      };
      const present = document.querySelector<HTMLElement>(SITE_HEADER_SELECTOR);
      if (present) {
        watch(present);
        return () => stop?.();
      }
      // A header that mounts after this hook: wait for it, then watch it.
      const arrival = new MutationObserver(() => {
        const header = document.querySelector<HTMLElement>(SITE_HEADER_SELECTOR);
        if (!header) return;
        arrival.disconnect();
        watch(header);
      });
      arrival.observe(document.body, { childList: true, subtree: true });
      return () => {
        arrival.disconnect();
        stop?.();
      };
    }

    const measure = () => {
      let total = 0;
      const header = document.querySelector('header');
      if (header) total += header.offsetHeight;
      const bar = document.querySelector('[data-announcement-bar]');
      if (bar instanceof HTMLElement) total += bar.offsetHeight;
      setHeight(total > 0 ? total : defaultHeight);
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    const header = document.querySelector('header');
    if (header) resizeObserver.observe(header);
    const bar = document.querySelector('[data-announcement-bar]');
    if (bar) resizeObserver.observe(bar);

    const mutationObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          measure();
          const newBar = document.querySelector('[data-announcement-bar]');
          if (newBar) resizeObserver.observe(newBar);
        }
      }
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-announcement-bar'],
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [defaultHeight, enabled, stuckOnly]);

  return height;
}
