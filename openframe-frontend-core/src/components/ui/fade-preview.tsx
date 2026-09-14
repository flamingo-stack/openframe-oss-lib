'use client';

import { ChevronDown } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useIsomorphicLayoutEffect } from '../../hooks/ui/use-isomorphic-layout-effect';
import { cn } from '../../utils/cn';

/**
 * FadePreview — the single shared progressive-disclosure primitive for
 * long lists/sections: renders children inside a height-clamped wrapper
 * whose bottom fades out via a CSS mask, with a "Show N more / Show less"
 * toggle below.
 *
 * Extracted from `ReleaseChangelogSection`'s `previewFirst` mode (which
 * itself unified the investor-update detail page's duplicated
 * `FadedHighlightSection`). Every fade-preview surface must compose THIS
 * component — do not re-inline the mask/clamp/toggle trio.
 *
 * When `hiddenCount <= 0` the children render unclamped and no toggle
 * shows (single-entry sections need no disclosure).
 *
 * `fixedHeight` is the mode for a block whose height must not move (a list of
 * command boxes, text filled in live): the collapsed height is held even when
 * the content is shorter, overflow is MEASURED instead of counted, and the
 * toggle row is always reserved. The block changes height only when the reader
 * expands it. It never scrolls inside: the page stays the only scroll surface,
 * so a wheel over the block always moves the page.
 */
export interface FadePreviewProps {
  /** How many items are visually hidden while collapsed — drives the
   *  "Show N more" label. Pass `total - visible`; `<= 0` disables the
   *  clamp + fade + toggle entirely. Ignored under `fixedHeight`, which
   *  measures overflow itself. */
  hiddenCount?: number;
  /** Collapsed height: px, or any CSS length (e.g. a line-height token
   *  multiple). ~120px shows one changelog entry's title + the start of its
   *  description before the mask kicks in. Callers with taller rows (e.g.
   *  delivery tables) pass a larger value. */
  collapsedHeight?: number | string;
  /** Reset the expanded state when this value changes — otherwise a
   *  parent that refetches and shrinks the list would leave a stale
   *  "expanded" state and a momentarily-wrong "Show 0 more" button.
   *  Callers typically pass the item count. */
  resetKey?: unknown;
  /** Hold the collapsed height for short content, measure overflow, reserve the toggle row. */
  fixedHeight?: boolean;
  /** Toggle wording. Defaults to "Show N more" / "Show less". */
  labels?: { more: string; less: string };
  /** Classes for the toggle button (e.g. its spacing inside a bordered box). */
  toggleClassName?: string;
  children: React.ReactNode;
}

const cssLength = (value: number | string) => (typeof value === 'number' ? `${value}px` : value);

export function FadePreview({
  hiddenCount = 0,
  collapsedHeight = 120,
  resetKey,
  fixedHeight = false,
  labels,
  toggleClassName,
  children,
}: FadePreviewProps) {
  const [expanded, setExpanded] = useState(false);
  // Overflow is a MEASUREMENT (text wraps to the live width), so it is unknown
  // until the first layout pass. Nothing about the block's HEIGHT depends on it:
  // the collapsed height is in the markup and the toggle row is always
  // reserved. Only the fade and the toggle's visibility wait for the measure,
  // which on the client happens before paint.
  const [overflows, setOverflows] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Collapse when the caller's `resetKey` changes. Adjusted while rendering —
  // React's documented pattern for a prop-driven reset — rather than from an
  // effect: the layout effect below sets `max-height` from `expanded` on the
  // same commit, so resetting a commit late made the panel snap open at the new
  // list's full height and then collapse again.
  const [collapsedFor, setCollapsedFor] = useState(resetKey);
  if (collapsedFor !== resetKey) {
    setCollapsedFor(resetKey);
    setExpanded(false);
  }

  // The expanded height is a DOM MEASUREMENT, so it is applied to the node in
  // a layout effect rather than read during render. Reading `scrollHeight` in
  // the render body measured whatever the previous commit had laid out and
  // then never looked again: children that grew after expanding (an image
  // finishing load, a lazily rendered row) stayed clipped at the old height
  // with no re-render able to correct it, and the `?? 2000` fallback silently
  // capped anything taller on the very first expand. Unconditional, so every
  // commit re-measures, and it runs before paint so the height transition
  // still animates from the collapsed value.
  useIsomorphicLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (!fixedHeight) {
      el.style.maxHeight = expanded ? `${el.scrollHeight}px` : cssLength(collapsedHeight);
      return;
    }
    // Fixed mode sets `height`, not `max-height`, so short content keeps the
    // collapsed height too. Overflow is read while collapsed (content taller
    // than the box), which is the only state the fade and the toggle depend on.
    el.style.height = expanded ? `${el.scrollHeight}px` : cssLength(collapsedHeight);
    if (!expanded) {
      const next = el.scrollHeight > el.clientHeight + 1;
      if (next !== overflows) setOverflows(next);
    }
  });

  // A width change re-wraps text without a React commit; re-measure then too.
  useEffect(() => {
    const el = contentRef.current;
    if (!fixedHeight || !el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (expanded) return;
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fixedHeight, expanded]);

  const needsFade = fixedHeight ? overflows : hiddenCount > 0;

  // No disclosure needed → no clamp wrapper at all. (Keeping the wrapper
  // with a `scrollHeight ?? 2000` max-height would clip tall content on
  // the first render, before the ref measures.)
  if (!fixedHeight && !needsFade) return <>{children}</>;

  const showToggle = needsFade || expanded;
  const moreLabel = labels?.more ?? `Show ${hiddenCount} more`;
  const lessLabel = labels?.less ?? 'Show less';

  return (
    <div className="relative">
      <div
        ref={contentRef}
        className="overflow-hidden transition-[max-height,height] duration-500"
        style={{
          transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
          // Fixed mode renders the collapsed height INTO the markup, so the
          // server-rendered block is already clamped and hydration never shrinks
          // it. The expanded value is a live DOM measurement, so the layout
          // effect above owns it (and `maxHeight` in the counted mode).
          ...(fixedHeight && !expanded ? { height: cssLength(collapsedHeight) } : {}),
          ...(!expanded && needsFade
            ? {
                maskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)',
              }
            : {}),
        }}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        // Fixed mode ALWAYS renders the row so the block keeps its height; it is
        // just not visible or focusable while there is nothing to disclose.
        aria-hidden={showToggle ? undefined : true}
        tabIndex={showToggle ? undefined : -1}
        className={cn(
          'mt-4 flex items-center gap-1.5 text-ods-text-secondary transition-colors duration-200 text-h6 hover:text-ods-accent',
          !showToggle && 'invisible',
          toggleClassName,
        )}
      >
        <span>{expanded ? lessLabel : moreLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}
