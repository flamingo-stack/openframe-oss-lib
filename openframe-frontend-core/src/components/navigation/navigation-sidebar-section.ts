'use client';

import { useCallback, useState } from 'react';
import { useIsomorphicLayoutEffect } from '../../hooks/ui/use-isomorphic-layout-effect';
import { cn } from '../../utils';

/**
 * Who scrolls the section (`NavigationSidebarConfig.sectionSlot`) once the host
 * sets `sectionMinHeight`: the section itself, filling the room the tree leaves
 * (`'section'`), or the sidebar body around it, with the section at its full
 * height in the flow (`'body'`).
 */
export type NavigationSectionScroller = 'section' | 'body';

const px = (value: string): number => Number.parseFloat(value) || 0;

/**
 * The height the section would get by filling the body: the body's inner
 * height less everything else in it — the other children with their margins,
 * the section's own margins, the gaps. None of these depends on who scrolls, so
 * the answer is the same in both layouts and switching cannot oscillate.
 */
export function measureNavigationSectionRoom(body: HTMLElement, section: HTMLElement): number {
  const bodyStyle = getComputedStyle(body);
  let room = body.clientHeight - px(bodyStyle.paddingTop) - px(bodyStyle.paddingBottom);
  let shown = 0;
  for (const child of Array.from(body.children)) {
    const style = getComputedStyle(child);
    if (style.display === 'none') continue;
    shown += 1;
    room -= px(style.marginTop) + px(style.marginBottom);
    if (child !== section) room -= child.getBoundingClientRect().height;
  }
  return room - Math.max(0, shown - 1) * px(bodyStyle.rowGap);
}

/**
 * Decides who scrolls the section. Put the returned `ref` on the section's
 * wrapper, a DIRECT child of the scrolling body (the body is its parent).
 *
 * Measured, not CSS: "fill the rest" and "full height in the flow" are two
 * layouts, and which one applies depends on the room the tree leaves — which
 * changes with every group that opens. The body, each of its children (a group
 * opening, a slot changing height) and the child list itself are watched.
 * Before the first measurement — and with `minHeight` undefined — the section
 * scrolls, as it always did.
 */
export function useNavigationSectionScroller(minHeight: number | undefined) {
  const [section, setSection] = useState<HTMLElement | null>(null);
  const [scroller, setScroller] = useState<NavigationSectionScroller>('section');
  // A callback ref, so a section that mounts later (a slot the host adds once
  // a lock lifts) is measured too.
  const ref = useCallback((node: HTMLElement | null) => setSection(node), []);

  useIsomorphicLayoutEffect(() => {
    const body = section?.parentElement;
    if (minHeight === undefined || !section || !body) return undefined;
    const measure = () => setScroller(measureNavigationSectionRoom(body, section) < minHeight ? 'body' : 'section');
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    const observeChildren = () => {
      if (!resize) return;
      resize.disconnect();
      resize.observe(body);
      for (const child of Array.from(body.children)) resize.observe(child);
    };
    const mutations =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => {
            observeChildren();
            measure();
          });
    observeChildren();
    mutations?.observe(body, { childList: true });
    measure();
    return () => {
      resize?.disconnect();
      mutations?.disconnect();
    };
  }, [section, minHeight]);

  return { ref, scroller: minHeight === undefined ? ('section' as const) : scroller };
}

/**
 * The section wrapper's props for a `sectionMinHeight`: filling the rest with
 * its own scroll, or in the body's flow at its full height. Both keep the
 * minimum, so the frame between a resize and its measurement overflows the body
 * rather than squeezing the section.
 */
export function navigationSectionLayout(scroller: NavigationSectionScroller, minHeight: number, className?: string) {
  return {
    'data-section-scroll': scroller,
    style: { minHeight },
    className: cn('flex flex-col', scroller === 'section' ? 'flex-1 overflow-y-auto' : 'flex-none', className),
  };
}
