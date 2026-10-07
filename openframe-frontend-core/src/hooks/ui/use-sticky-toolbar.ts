'use client';

import { type CSSProperties, useCallback, useEffect, useState } from 'react';

interface StickyToolbar {
  /** Attach to the sticky toolbar element whose height drives the table-header offset. */
  toolbarRef: (node: HTMLDivElement | null) => void;
  /** Apply to the element wrapping both the toolbar and the table; publishes the measured height. */
  containerStyle: CSSProperties;
  /** Pass to DataTable.Header's `stickyHeaderOffset` so it pins right below the toolbar. */
  stickyHeaderOffset: string;
}

/**
 * Keeps a sticky filter toolbar pinned above a sticky table header. (The page's
 * OWN header and announcement bar are `useHeaderHeight`'s: that one reads the
 * document's chrome; this one measures the toolbar element it is handed.)
 *
 * How: The toolbar
 * height is measured (it changes as the single-row tag list appears or collapses)
 * and published as `--sticky-toolbar-h` on the container, which the table header
 * reads via `top-[var(--sticky-toolbar-h)]`, so the header always pins flush
 * below the toolbar without a hard-coded offset.
 *
 * A CALLBACK ref, not a ref object: a toolbar can be conditionally rendered (a
 * list with nothing in it hides its search box), and a plain `useRef` + mount
 * effect would neither measure a toolbar that appears later nor zero the offset
 * for one that goes away, the header would then pin below a strip that is no
 * longer there.
 */
export function useStickyToolbar(): StickyToolbar {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);

  const toolbarRef = useCallback((el: HTMLDivElement | null) => setNode(el), []);

  // No toolbar mounted → no offset. Derived during render rather than in the
  // effect: the effect's job is the ResizeObserver, and zeroing here means the
  // header never pins below a strip that has already gone.
  const [lastNode, setLastNode] = useState(node);
  if (node !== lastNode) {
    setLastNode(node);
    if (!node) setHeight(0);
  }

  useEffect(() => {
    if (!node) return undefined;
    const update = () => setHeight(node.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return {
    toolbarRef,
    containerStyle: { '--sticky-toolbar-h': `${height}px` } as CSSProperties,
    stickyHeaderOffset: 'top-[var(--sticky-toolbar-h)]',
  };
}
