'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useAutoplay } from '../../hooks/ui/use-autoplay';
import { useInView } from '../../hooks/ui/use-in-view';
import { cn } from '../../utils/cn';
import { Chevron02LeftIcon } from '../icons-v2-generated/arrows/chevron-02-left-icon';
import { Chevron02RightIcon } from '../icons-v2-generated/arrows/chevron-02-right-icon';
import { PlaybackToggle } from './playback-toggle';

/** The row under the track: the dots, the counter, the pause and the two arrows (the arrows set its height). */
const SNAP_CAROUSEL_CONTROLS_CLASS = 'mt-3 flex items-center gap-2';

/**
 * The carousel's controls row while its slides load: the same box (margin and
 * height), empty. A skeleton of a carousel is its slides' skeleton over this,
 * so the block keeps its height when the slides land.
 */
export function SnapCarouselControlsSkeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn(SNAP_CAROUSEL_CONTROLS_CLASS, 'h-11', className)} />;
}

export interface SnapCarouselProps<T> {
  items: readonly T[];
  renderItem: (item: T, index: number) => ReactNode;
  getKey?: (item: T, index: number) => string | number;
  /** Names the carousel for assistive tech. */
  label: string;
  /** Move to the next slide after this long. `0` turns auto-advance off. Default 5000. */
  autoAdvanceMs?: number;
  /** Names of the stop/start control. */
  playLabel?: string;
  pauseLabel?: string;
  /** Width of one slide. Default `basis-[300px]`. */
  slideClassName?: string;
  prevLabel?: string;
  nextLabel?: string;
  /** A slide to bring into view whenever this value changes (a link that names it). Only the track moves, never the page. */
  focusIndex?: number;
  className?: string;
}

const GAP_PX = 12;

/**
 * The active dot filling up while the carousel waits to advance. A transition,
 * not a keyframe animation: it mounts empty and is told to be full one frame
 * later, taking the whole interval to get there.
 */
function DotFill({ durationMs }: { durationMs: number }) {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setFull(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <span
      className="absolute inset-0 origin-left bg-ods-text-primary transition-transform ease-linear"
      style={{ transform: full ? 'scaleX(1)' : 'scaleX(0)', transitionDuration: `${durationMs}ms` }}
    />
  );
}

/**
 * A native scroll-snap carousel: swipe or use the arrows; dots show the
 * position, a counter says it in words.
 *
 * WHEN IT ADVANCES is `useAutoplay`'s rule, the same one the looping demos
 * use: mostly on screen, tab visible, not paused, motion allowed. A swipe or
 * an arrow moves it and it carries on from there after a full interval; it
 * waits only while a finger or the mouse button is actually down on it. The
 * small pause control stops it for good, and starts it again. While it is
 * auto-playing the active dot fills over the interval, so the wait is visible.
 */
export function SnapCarousel<T>({
  items,
  renderItem,
  getKey,
  label,
  autoAdvanceMs = 5000,
  playLabel,
  pauseLabel,
  slideClassName = 'basis-[300px]',
  prevLabel = 'Previous',
  nextLabel = 'Next',
  focusIndex,
  className,
}: SnapCarouselProps<T>) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  // Held only while a finger or the mouse button is down on it: the visitor is mid-swipe.
  const [pressed, setPressed] = useState(false);
  const { ref: viewRef, inView } = useInView<HTMLDivElement>({ threshold: 0.5 });
  const auto = useAutoplay(inView);
  const count = items.length;

  const slideStep = useCallback(() => {
    const first = trackRef.current?.firstElementChild as HTMLElement | null;
    return first ? first.offsetWidth + GAP_PX : 0;
  }, []);

  const goTo = useCallback(
    (next: number) => {
      const track = trackRef.current;
      const step = slideStep();
      if (!track || step === 0) return;
      const clamped = Math.max(0, Math.min(count - 1, next));
      track.scrollTo({ left: clamped * step, behavior: 'smooth' });
    },
    [count, slideStep],
  );

  // Only a change of `focusIndex` moves the track: `goTo` is read through a ref,
  // so more items arriving never pulls a visitor back to a slide named earlier.
  const goToRef = useRef(goTo);
  useEffect(() => {
    goToRef.current = goTo;
  }, [goTo]);
  useEffect(() => {
    if (focusIndex !== undefined && focusIndex >= 0) goToRef.current(focusIndex);
  }, [focusIndex]);

  const onScroll = useCallback(() => {
    const track = trackRef.current;
    const step = slideStep();
    if (!track || step === 0) return;
    setIndex(Math.min(count - 1, Math.round(track.scrollLeft / step)));
  }, [count, slideStep]);

  // The release is listened for on the WINDOW: a press that ends outside the
  // carousel (a drag that leaves it, a scroll the browser takes over) must
  // still end, or the carousel would wait forever.
  useEffect(() => {
    if (!pressed) return undefined;
    const release = () => setPressed(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
    };
  }, [pressed]);

  const canAutoAdvance = autoAdvanceMs > 0 && count > 1;
  const playing = auto.playing && canAutoAdvance && !pressed;

  // Restarts on every slide change, so a swipe or an arrow is followed by a full interval.
  useEffect(() => {
    if (!playing) return undefined;
    const timer = setTimeout(() => goTo(index >= count - 1 ? 0 : index + 1), autoAdvanceMs);
    return () => clearTimeout(timer);
  }, [playing, index, count, autoAdvanceMs, goTo]);

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      trackRef.current = node;
      viewRef(node);
    },
    [viewRef],
  );

  if (count === 0) return null;

  return (
    <div className={className} onPointerDown={() => setPressed(true)}>
      <div
        ref={setRefs}
        onScroll={onScroll}
        role="group"
        aria-roledescription="carousel"
        aria-label={label}
        className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto"
        style={{ gap: GAP_PX }}
      >
        {items.map((item, itemIndex) => (
          <div
            key={getKey ? getKey(item, itemIndex) : itemIndex}
            role="group"
            aria-roledescription="slide"
            aria-label={`${itemIndex + 1} / ${count}`}
            aria-hidden={itemIndex !== index}
            className={cn('flex shrink-0 grow-0 snap-start', slideClassName)}
          >
            <div className="min-w-0 flex-1">{renderItem(item, itemIndex)}</div>
          </div>
        ))}
      </div>
      <div className={SNAP_CAROUSEL_CONTROLS_CLASS}>
        <span className="flex gap-1.5" aria-hidden>
          {items.map((_, dotIndex) => (
            <span
              key={dotIndex}
              className={cn(
                'relative h-1.5 overflow-hidden rounded-full transition-[width] duration-200 motion-reduce:transition-none',
                dotIndex === index ? 'w-6' : 'w-1.5',
                dotIndex === index && !playing ? 'bg-ods-text-primary' : 'bg-ods-border',
              )}
            >
              {dotIndex === index && playing && (
                // Re-keyed per slide so the fill restarts from empty.
                <DotFill key={index} durationMs={autoAdvanceMs} />
              )}
            </span>
          ))}
        </span>
        <span
          className="ml-auto mr-1 whitespace-nowrap text-ods-text-secondary text-h5"
          aria-live={playing ? 'off' : 'polite'}
        >
          {index + 1} / {count}
        </span>
        {canAutoAdvance && !auto.reducedMotion && (
          <PlaybackToggle
            paused={auto.paused}
            onChange={auto.setPaused}
            playLabel={playLabel}
            pauseLabel={pauseLabel}
          />
        )}
        <button
          type="button"
          aria-label={prevLabel}
          disabled={index === 0}
          onClick={() => goTo(index - 1)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ods-border text-ods-text-primary outline-none transition-colors hover:bg-ods-card focus-visible:ring-2 focus-visible:ring-ods-focus disabled:cursor-default disabled:text-ods-text-secondary disabled:opacity-50 disabled:hover:bg-transparent"
        >
          <Chevron02LeftIcon size={20} />
        </button>
        <button
          type="button"
          aria-label={nextLabel}
          disabled={index === count - 1}
          onClick={() => goTo(index + 1)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ods-border text-ods-text-primary outline-none transition-colors hover:bg-ods-card focus-visible:ring-2 focus-visible:ring-ods-focus disabled:cursor-default disabled:text-ods-text-secondary disabled:opacity-50 disabled:hover:bg-transparent"
        >
          <Chevron02RightIcon size={20} />
        </button>
      </div>
    </div>
  );
}
