'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useContentMdUp } from '../../hooks/ui/use-content-breakpoint';
import { cn } from '../../utils/cn';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from './loading-scope';

/** The bar's height in px: below the content `md` step, and from it (the bar switches on the content's width). */
export const PROGRESS_BAR_HEIGHT = { mobile: 8, desktop: 24 } as const;
/** The same heights as a class (8px, 24px from `content-md`), read by the bar's box and by its skeleton. */
const PROGRESS_BAR_HEIGHT_CLASS = 'h-2 content-md:h-6';

/** The bar while its value is read: one box at the bar's own height, switched at the bar's own step. */
function ProgressBarSkeleton({ className }: { className?: string }) {
  return <UnifiedSkeleton className={cn(PROGRESS_BAR_HEIGHT_CLASS, 'w-full rounded', className)} />;
}

type ProgressBarProps = {
  progress: number; // 0–100
  warningThreshold?: number; // default 70
  criticalThreshold?: number; // default 90
  segmentWidth?: number; // desktop segment width (px)
  mobileSegmentWidth?: number; // mobile segment width (px)
  segmentGap?: number; // px, default 2
  height?: number; // desktop height (px)
  mobileHeight?: number; // mobile height (px)
  inverted?: boolean; // if true, high values are good (green), low values are bad (red)
  /**
   * `threshold` (default): the fill takes the success, warning or error colour by the thresholds. `neutral`: the fill
   * is the secondary text colour at every value, for a count that is progress, not a health reading (a sign-off
   * count), so a partial bar never reads as an error.
   */
  tone?: 'threshold' | 'neutral';
  /** A fixed fill colour (a CSS colour value, e.g. `var(--ods-accent)`), overriding `tone` and the thresholds: for a
   *  host that colours the bar by its own rule. */
  fillColor?: string;
  /** The colour of the empty segments (default `var(--color-bg-surface-active)`). */
  trackColor?: string;
  /** From this percentage on, empty segments take `dimTrackColor` instead of `trackColor`: marks a zone of the bar
   *  (e.g. where a chat's memory is compacted). Filled segments keep the fill colour. */
  dimTrackFrom?: number;
  /** The empty segments' colour from `dimTrackFrom` (default `var(--color-bg-surface-active)`). */
  dimTrackColor?: string;
  /** The value is still being read: the bar draws its `ProgressBarSkeleton` at its own height. A loading scope does
   *  the same. */
  loading?: boolean;
};

/** Empty segments, unless the host names its own track colours. */
const UNFILLED_SEGMENT_COLOR = 'var(--color-bg-surface-active)';

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  warningThreshold = 75,
  criticalThreshold = 90,
  segmentWidth = 3.43,
  mobileSegmentWidth = 5,
  segmentGap = 2,
  height = PROGRESS_BAR_HEIGHT.desktop,
  mobileHeight = PROGRESS_BAR_HEIGHT.mobile,
  inverted = false,
  tone = 'threshold',
  fillColor,
  trackColor = UNFILLED_SEGMENT_COLOR,
  dimTrackFrom,
  dimTrackColor = UNFILLED_SEGMENT_COLOR,
  loading: loadingProp,
}) => {
  // ONE switch: in a page's loading state (or while the host reads the value) the bar is its skeleton.
  const loading = useLoadingScope() || !!loadingProp;
  const isMdUp = useContentMdUp() ?? true;
  const effectiveSegmentWidth = isMdUp ? segmentWidth : mobileSegmentWidth;
  const effectiveHeight = isMdUp ? height : mobileHeight;

  const containerRef = useRef<HTMLDivElement>(null);
  const [segmentCount, setSegmentCount] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        // N segments have only (N-1) gaps, so add one gap back before dividing —
        // otherwise the last segment is dropped due to a phantom trailing gap.
        const count = Math.floor((width + segmentGap) / (effectiveSegmentWidth + segmentGap));
        setSegmentCount(count);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
    // `loading`: the box is mounted when the value arrives, so its segments are counted then.
  }, [effectiveSegmentWidth, segmentGap, loading]);

  if (loading) return <ProgressBarSkeleton />;

  // Pick color based on thresholds using ODS design tokens
  const getColor = () => {
    if (fillColor) return fillColor;
    if (tone === 'neutral') return 'var(--color-text-secondary)';
    if (inverted) {
      // Inverted: high values = good (green), low values = bad (red)
      // For battery health: 100% = green, <30% = red
      if (progress >= criticalThreshold) return 'var(--color-success)'; // high = green
      if (progress >= warningThreshold) return 'var(--color-warning)'; // medium = warning
      return 'var(--color-error)'; // low = red
    } else {
      // Normal: high values = bad (red), low values = good (green)
      // For disk usage: 100% = red, <70% = green
      if (progress >= criticalThreshold) return 'var(--color-error)'; // critical red
      if (progress >= warningThreshold) return 'var(--color-warning)'; // warning yellow
      return 'var(--color-success)'; // base green
    }
  };

  // A NaN or out-of-range value (a total of 0 upstream) draws an empty or a full bar, never a broken one.
  const safeProgress = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0;
  const filledCount = Math.round((safeProgress / 100) * segmentCount);
  const dimFromIndex = dimTrackFrom == null ? segmentCount : Math.round((dimTrackFrom / 100) * segmentCount);
  const segmentColor = (i: number) => {
    if (i < filledCount) return getColor();
    return i >= dimFromIndex ? dimTrackColor : trackColor;
  };

  return (
    <div
      ref={containerRef}
      // The box holds the bar's height before its segments are counted: the default heights by the class the skeleton
      // reads, a host's own by style.
      className={cn(
        'flex w-full',
        height === PROGRESS_BAR_HEIGHT.desktop &&
          mobileHeight === PROGRESS_BAR_HEIGHT.mobile &&
          PROGRESS_BAR_HEIGHT_CLASS,
      )}
      style={{ gap: `${segmentGap}px` }}
    >
      {Array.from({ length: segmentCount }).map((_, i) => (
        <div
          key={i}
          className="rounded"
          style={{
            width: `${effectiveSegmentWidth}px`,
            height: `${effectiveHeight}px`,
            backgroundColor: segmentColor(i),
          }}
        />
      ))}
    </div>
  );
};
