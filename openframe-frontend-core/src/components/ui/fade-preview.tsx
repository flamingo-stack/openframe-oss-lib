"use client"

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

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

export function FadePreview({
  hiddenCount,
  collapsedHeight = 120,
  resetKey,
  children,
}: FadePreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setExpanded(false);
  }, [resetKey]);

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
          maxHeight: expanded
            ? contentRef.current?.scrollHeight ?? 2000
            : collapsedHeight,
          ...(!expanded ? {
            maskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 30%, transparent 100%)',
          } : {}),
        }}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-4 flex items-center gap-1.5 text-sm text-ods-text-secondary hover:text-ods-accent transition-colors duration-200"
      >
        <span>{expanded ? 'Show less' : `Show ${hiddenCount} more`}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
    </div>
  );
}
