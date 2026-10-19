'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useAutoplay } from '../../hooks/ui/use-autoplay';
import { useInView } from '../../hooks/ui/use-in-view';
import { useResumableTimeout } from '../../hooks/ui/use-resumable-timeout';
import { cn } from '../../utils/cn';
import { Chevron02LeftIcon } from '../icons-v2-generated/arrows/chevron-02-left-icon';
import { Chevron02RightIcon } from '../icons-v2-generated/arrows/chevron-02-right-icon';

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
  /** Width of one slide. Default `basis-[300px]`. */
  slideClassName?: string;
  prevLabel?: string;
  nextLabel?: string;
  /** A slide to bring into view whenever this value changes (a link that names it). Only the track moves, never the page. */
  focusIndex?: number;
  /** The slides are read data (a list whose length is the record's): each slide is marked an item of ONE read list
   *  (`data-loading-item`), so a loading state drawn with the same carousel has the same structure as the loaded one. */
  readItems?: boolean;
  className?: string;
}

const GAP_PX = 12;

/**
 * The active dot's fill: how much of the slide's wait has been run. It starts
 * from where the wait stands (`ranMs`, nothing for a new slide) and runs to
 * full over what is LEFT of it. While the carousel is not advancing it stands
 * still at that point; it never empties because the carousel left the screen.
 */
function DotFill({ durationMs, ranMs, running }: { durationMs: number; ranMs: number; running: boolean }) {
  // One frame at the starting point, so the browser has it to run from.
  const [going, setGoing] = useState(false);
  useEffect(() => {
    if (!running) return undefined;
    const frame = requestAnimationFrame(() => setGoing(true));
    return () => {
      cancelAnimationFrame(frame);
      setGoing(false);
    };
  }, [running]);
  const moving = running && going;
  return (
    <span
      className="absolute inset-0 origin-left bg-ods-text-primary ease-linear"
      style={{
        transform: `scaleX(${moving ? 1 : durationMs > 0 ? ranMs / durationMs : 0})`,
        transitionProperty: moving ? 'transform' : 'none',
        transitionDuration: `${Math.max(0, durationMs - ranMs)}ms`,
      }}
    />
  );
}

/**
 * A native scroll-snap carousel: swipe or use the arrows; dots show the
 * position, a counter says it in words.
 *
 * WHEN IT ADVANCES is `useAutoplay`'s rule, the same one the looping demos
 * use: mostly on screen, tab visible, not paused, motion allowed. A swipe or
 * an arrow moves it and it carries on from there after a full interval. It
 * waits while the visitor holds it (`useAutoplay`'s hold: a finger or the
 * mouse button down on it, the keyboard inside it); there is no pause button. While it is auto-playing the active dot fills over the
 * interval, so the wait is visible.
 */
export function SnapCarousel<T>({
  items,
  renderItem,
  getKey,
  label,
  autoAdvanceMs = 5000,
  slideClassName = 'basis-[300px]',
  prevLabel = 'Previous',
  nextLabel = 'Next',
  focusIndex,
  readItems = false,
  className,
}: SnapCarouselProps<T>) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
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

  const canAutoAdvance = autoAdvanceMs > 0 && count > 1;
  const playing = auto.playing && canAutoAdvance;

  // A new slide starts a whole interval (a swipe or an arrow is followed by a
  // full one); an interruption (off screen, a hold, another tab) only pauses it.
  const ranMs = useResumableTimeout({
    running: playing,
    durationMs: autoAdvanceMs,
    resetKey: index,
    onElapsed: () => goTo(index >= count - 1 ? 0 : index + 1),
  });
  const showsWait = canAutoAdvance && !auto.reducedMotion;

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      trackRef.current = node;
      viewRef(node);
    },
    [viewRef],
  );

  if (count === 0) return null;

  return (
    <div className={className} {...auto.holdProps}>
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
            // Never `aria-hidden`: the neighbouring slides are on screen and their links take focus.
            aria-current={itemIndex === index ? 'true' : undefined}
            className={cn('flex shrink-0 grow-0 snap-start', slideClassName)}
            data-loading-item={readItems || undefined}
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
                // A carousel that never advances by itself marks its slide with a whole dot.
                dotIndex === index && !showsWait ? 'bg-ods-text-primary' : 'bg-ods-border',
              )}
            >
              {dotIndex === index && showsWait && (
                // Re-keyed per slide so a NEW slide starts from empty; a pause keeps its place.
                <DotFill key={index} durationMs={autoAdvanceMs} ranMs={ranMs} running={playing} />
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
