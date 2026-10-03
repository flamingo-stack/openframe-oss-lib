'use client';

import { ChevronDown } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useIsomorphicLayoutEffect } from '../../hooks/ui/use-isomorphic-layout-effect';
import { cn } from '../../utils/cn';
import { Button } from './button';

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
  /**
   * Collapse to the first N ITEMS of a list instead of a length: the single child
   * is the list, its children are the items, and the collapsed height is
   * MEASURED to the bottom of item N (at every width). Implies `fixedHeight`, so
   * the block keeps that height loading or loaded, and "Show N more" counts the
   * items past N unless `hiddenCount` says otherwise. Until the list holds N
   * items, `collapsedHeight` (or the height last measured) is kept.
   */
  visibleItems?: number;
  /**
   * Take the height of the cell it sits in instead of a collapsed height: a
   * column beside a taller card, where the grid row's height comes from that
   * card. The content is laid out absolutely inside the cell (so it never makes
   * the row taller), clipped there, and fades out when it overflows. `'md'` /
   * `'lg'`: only from that width up (below it the columns stack, the content
   * shows whole and nothing fades). `true`: at every width.
   */
  fill?: boolean | 'md' | 'lg';
  /** Render the "Show more / Show less" row. `false` for a preview that only fades (another link leads to the rest). Default true. */
  toggle?: boolean;
  children: React.ReactNode;
}

/** The content's box in fill mode, per breakpoint (spelled out: Tailwind only emits classes it can read). */
const FILL_CLASSES: Record<string, string> = {
  true: 'absolute inset-0',
  md: 'md:absolute md:inset-0',
  lg: 'lg:absolute lg:inset-0',
};

const cssLength = (value: number | string) => (typeof value === 'number' ? `${value}px` : value);

export function FadePreview({
  hiddenCount = 0,
  collapsedHeight: collapsedHeightProp,
  resetKey,
  fixedHeight = false,
  labels,
  toggleClassName,
  visibleItems,
  fill = false,
  toggle = true,
  children,
}: FadePreviewProps) {
  const visible = visibleItems ?? 0;
  const itemMode = visible > 0;
  const fixed = fixedHeight || itemMode || fill;
  // The height of the first `visibleItems` items, measured (item mode only).
  const [itemsHeight, setItemsHeight] = useState<number | null>(null);
  const [itemCount, setItemCount] = useState(0);
  // Item mode holds its natural height until the first measure (no clamp a
  // server render could show and hydration then shrink); otherwise 120px.
  const collapsedHeight = collapsedHeightProp ?? (itemMode ? 'auto' : 120);
  const collapsed = itemMode && itemsHeight != null ? itemsHeight : collapsedHeight;
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
    if (!fixed) {
      el.style.maxHeight = expanded ? `${el.scrollHeight}px` : cssLength(collapsedHeight);
      return;
    }
    // Fixed mode sets `height`, not `max-height`, so short content keeps the
    // collapsed height too. Overflow is read while collapsed (content taller
    // than the box), which is the only state the fade and the toggle depend on.
    if (itemMode) {
      const items = el.firstElementChild?.children;
      const count = items?.length ?? 0;
      if (count !== itemCount) setItemCount(count);
      const last = count >= visible ? items?.[visible - 1] : undefined;
      if (last) {
        const next = Math.round(last.getBoundingClientRect().bottom - el.getBoundingClientRect().top + el.scrollTop);
        if (next !== itemsHeight) setItemsHeight(next);
      }
    }
    // Fill mode: the parent decides the height (CSS), only overflow is read.
    if (!fill) el.style.height = expanded ? `${el.scrollHeight}px` : cssLength(collapsed);
    if (!expanded) {
      const next = el.scrollHeight > el.clientHeight + 1;
      if (next !== overflows) setOverflows(next);
    }
  });

  // A width change re-wraps text without a React commit; re-measure then too.
  useEffect(() => {
    const el = contentRef.current;
    if (!fixed || !el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (expanded) return;
      setOverflows(el.scrollHeight > el.clientHeight + 1);
      // Item mode: the items re-wrap at a new width, so their height is re-read.
      const items = itemMode ? el.firstElementChild?.children : undefined;
      const last = items && items.length >= visible ? items[visible - 1] : undefined;
      if (last)
        setItemsHeight(Math.round(last.getBoundingClientRect().bottom - el.getBoundingClientRect().top + el.scrollTop));
    });
    observer.observe(el);
    if (itemMode && el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [fixed, itemMode, visible, expanded]);

  const needsFade = fixed ? overflows : hiddenCount > 0;
  const hidden = itemMode && hiddenCount <= 0 ? Math.max(0, itemCount - visible) : hiddenCount;

  // No disclosure needed → no clamp wrapper at all. (Keeping the wrapper
  // with a `scrollHeight ?? 2000` max-height would clip tall content on
  // the first render, before the ref measures.)
  if (!fixed && !needsFade) return <>{children}</>;

  const showToggle = needsFade || expanded;
  const moreLabel = labels?.more ?? `Show ${hidden} more`;
  const lessLabel = labels?.less ?? 'Show less';

  return (
    <div className="relative">
      <div
        ref={contentRef}
        className={cn(
          'overflow-hidden transition-[max-height,height] duration-500',
          fill && FILL_CLASSES[String(fill)],
        )}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
          // Fixed mode renders the collapsed height INTO the markup, so the
          // server-rendered block is already clamped and hydration never shrinks
          // it. The expanded value is a live DOM measurement, so the layout
          // effect above owns it (and `maxHeight` in the counted mode).
          ...(fixed && !fill && !expanded ? { height: cssLength(collapsed) } : {}),
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
      {/* The shared Button's quiet text-action variant. Fixed mode ALWAYS renders
          the row so the block keeps its height; it is just not visible or
          focusable while there is nothing to disclose. */}
      {toggle ? (
        <Button
          type="button"
          variant="link"
          size="compact"
          noPaddingX
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-hidden={showToggle ? undefined : true}
          tabIndex={showToggle ? undefined : -1}
          rightIcon={<ChevronDown className={cn('transition-transform duration-300', expanded && 'rotate-180')} />}
          className={cn('mt-[var(--spacing-system-mf)]', !showToggle && 'invisible', toggleClassName)}
        >
          {expanded ? lessLabel : moreLabel}
        </Button>
      ) : null}
    </div>
  );
}
