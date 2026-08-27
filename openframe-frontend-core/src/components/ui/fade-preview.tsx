'use client';

import { ChevronDown } from 'lucide-react';
import type React from 'react';
import { useState, useRef } from 'react';
import { useIsomorphicLayoutEffect } from '../../hooks/ui/use-isomorphic-layout-effect';

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
 */
export interface FadePreviewProps {
  /** How many items are visually hidden while collapsed — drives the
   *  "Show N more" label. Pass `total - visible`; `<= 0` disables the
   *  clamp + fade + toggle entirely. */
  hiddenCount: number;
  /** Collapsed height in px. ~120 shows one changelog entry's title +
   *  the start of its description before the mask kicks in. Callers with
   *  taller rows (e.g. delivery tables) pass a larger value. */
  collapsedHeight?: number;
  /** Reset the expanded state when this value changes — otherwise a
   *  parent that refetches and shrinks the list would leave a stale
   *  "expanded" state and a momentarily-wrong "Show 0 more" button.
   *  Callers typically pass the item count. */
  resetKey?: unknown;
  children: React.ReactNode;
}

export function FadePreview({ hiddenCount, collapsedHeight = 120, resetKey, children }: FadePreviewProps) {
  const [expanded, setExpanded] = useState(false);
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
    el.style.maxHeight = expanded ? `${el.scrollHeight}px` : `${collapsedHeight}px`;
  });

  const needsFade = hiddenCount > 0;

  // No disclosure needed → no clamp wrapper at all. (Keeping the wrapper
  // with a `scrollHeight ?? 2000` max-height would clip tall content on
  // the first render, before the ref measures.)
  if (!needsFade) return <>{children}</>;

  return (
    <div className="relative">
      <div
        ref={contentRef}
        className="overflow-hidden transition-[max-height] duration-500"
        style={{
          transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
          // `maxHeight` is intentionally absent — the layout effect above owns
          // it, because the expanded value is a live DOM measurement.
          ...(!expanded
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
        className="mt-4 flex items-center gap-1.5 text-ods-text-secondary transition-colors duration-200 text-h6 hover:text-ods-accent"
      >
        <span>{expanded ? 'Show less' : `Show ${hiddenCount} more`}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}
