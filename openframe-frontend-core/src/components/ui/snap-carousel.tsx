'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useAutoplay } from '../../hooks/ui/use-autoplay';
import { useInView } from '../../hooks/ui/use-in-view';
import { useResumableTimeout } from '../../hooks/ui/use-resumable-timeout';
import { cn } from '../../utils/cn';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { CarouselStepButton } from './carousel-step-button';
import { useLoadingScope } from './loading-scope';

/** The row under the track: the dots, the counter, the pause and the two arrows (the arrows set its height). */
const SNAP_CAROUSEL_CONTROLS_CLASS = 'mt-3 flex items-center gap-2';
/** The gap between two slides, in px (the track's and the step's). */
export const SNAP_CAROUSEL_GAP_PX = 12;
/** The track: one row of slides that snaps and scrolls sideways (read by the carousel and by a host's loading form). */
export const SNAP_CAROUSEL_TRACK_CLASS = 'scrollbar-hide flex snap-x snap-mandatory overflow-x-auto';
/** One slide of the track, in the carousel's own box. A host drawing its slides' loading form uses it too. */
export function SnapCarouselSlide({
  className,
  readItem = false,
  children,
  ...aria
}: {
  className?: string;
  /** The slide is an item of ONE read list (`data-loading-item`). */
  readItem?: boolean;
  children: ReactNode;
  'aria-label'?: string;
  'aria-current'?: 'true';
}) {
  return (
    <div
      role="group"
      aria-roledescription="slide"
      {...aria}
      className={cn('flex shrink-0 grow-0 snap-start', className)}
      data-loading-item={readItem || undefined}
    >
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export interface SnapCarouselControlsProps {
  /** How many slides the track holds (one dot each). */
  count: number;
  /** The slide in view. Default 0. */
  index?: number;
  prevLabel?: string;
  nextLabel?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  /** The carousel advances by itself: the active dot fills over the wait. */
  wait?: { durationMs: number; ranMs: number; running: boolean } | null;
  /** The counter is announced (`aria-live`); off while the carousel plays by itself. Default true. */
  announce?: boolean;
  /** The slides are read: the row draws its loading form (the dots and arrows real and inert, the counter a bar). In a
   *  loading scope it does the same. */
  loading?: boolean;
  className?: string;
}

/**
 * The row under a carousel's track: a dot per slide, the counter ("2 / 5") and the two arrows. Loading, it is the
 * same row, inert: the dots and arrows as they are (static controls), the counter (read data) a bar.
 */
export function SnapCarouselControls({
  count,
  index = 0,
  prevLabel = 'Previous',
  nextLabel = 'Next',
  onPrevious,
  onNext,
  wait = null,
  announce = true,
  loading: loadingProp = false,
  className,
}: SnapCarouselControlsProps) {
  // ONE switch: in a page's loading state, or while the slides are read, the row is inert and its counter a bar.
  const loading = useLoadingScope() || loadingProp;
  return (
    <div
      className={cn(SNAP_CAROUSEL_CONTROLS_CLASS, className)}
      aria-hidden={loading || undefined}
      inert={loading || undefined}
    >
      <span className="flex gap-1.5" aria-hidden>
        {Array.from({ length: count }, (_, dotIndex) => (
          <span
            key={dotIndex}
            className={cn(
              'relative h-1.5 overflow-hidden rounded-full transition-[width] duration-200 motion-reduce:transition-none',
              dotIndex === index ? 'w-6' : 'w-1.5',
              // A carousel that never advances by itself marks its slide with a whole dot.
              dotIndex === index && !wait ? 'bg-ods-text-primary' : 'bg-ods-border',
            )}
          >
            {dotIndex === index && wait && (
              // Re-keyed per slide so a NEW slide starts from empty; a pause keeps its place.
              <DotFill key={index} durationMs={wait.durationMs} ranMs={wait.ranMs} running={wait.running} />
            )}
          </span>
        ))}
      </span>
      {loading ? (
        <span className="ml-auto mr-1">
          <TextLineSkeleton type="h5" className="w-10" />
        </span>
      ) : (
        <span
          className="ml-auto mr-1 whitespace-nowrap text-ods-text-secondary text-h5"
          aria-live={announce ? 'polite' : 'off'}
        >
          {index + 1} / {count}
        </span>
      )}
      <CarouselStepButton
        direction="previous"
        aria-label={prevLabel}
        disabled={loading || index === 0}
        onClick={onPrevious}
      />
      <CarouselStepButton
        direction="next"
        aria-label={nextLabel}
        disabled={loading || index === count - 1}
        onClick={onNext}
      />
    </div>
  );
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
    return first ? first.offsetWidth + SNAP_CAROUSEL_GAP_PX : 0;
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

  // The slide at the track's left edge. At the end of the track, where several slides are in view and the track can
  // scroll no further, the slide is the LAST one: otherwise the index stopped short of it (9 of 11 with three slides
  // in view) and the carousel never reached the end to wrap back to the first.
  const onScroll = useCallback(() => {
    const track = trackRef.current;
    const step = slideStep();
    if (!track || step === 0) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    const atEnd = maxScroll > 0 && track.scrollLeft >= maxScroll - 1;
    setIndex(atEnd ? count - 1 : Math.min(count - 1, Math.round(track.scrollLeft / step)));
  }, [count, slideStep]);

  // Back one slide from where the track stands: at the end the index is the last slide, which sits further right
  // than the track can scroll, so stepping back from the index alone would not move it.
  const goBack = useCallback(() => {
    const track = trackRef.current;
    const step = slideStep();
    if (!track || step === 0) return;
    goTo(Math.min(index, Math.round(track.scrollLeft / step)) - 1);
  }, [goTo, index, slideStep]);

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
        className={SNAP_CAROUSEL_TRACK_CLASS}
        style={{ gap: SNAP_CAROUSEL_GAP_PX }}
      >
        {items.map((item, itemIndex) => (
          <SnapCarouselSlide
            key={getKey ? getKey(item, itemIndex) : itemIndex}
            aria-label={`${itemIndex + 1} / ${count}`}
            // Never `aria-hidden`: the neighbouring slides are on screen and their links take focus.
            aria-current={itemIndex === index ? 'true' : undefined}
            className={slideClassName}
            readItem={readItems}
          >
            {renderItem(item, itemIndex)}
          </SnapCarouselSlide>
        ))}
      </div>
      <SnapCarouselControls
        count={count}
        index={index}
        prevLabel={prevLabel}
        nextLabel={nextLabel}
        onPrevious={goBack}
        onNext={() => goTo(index + 1)}
        wait={showsWait ? { durationMs: autoAdvanceMs, ranMs, running: playing } : null}
        announce={!playing}
      />
    </div>
  );
}
