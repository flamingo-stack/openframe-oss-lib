'use client';

/**
 * <PhotoWall> — a wall of photos drifting in columns, from a plain list of
 * pictures. THE one photo wall: a caller hands over urls and nothing else.
 *
 * The wall reads each picture's REAL orientation (its natural size, once the
 * browser has it) and lays it out for that shape: a portrait in a tall frame,
 * a landscape in a wide one, a square in a square. It then sorts the pictures
 * so neighbouring frames differ and the columns come out the same height, and
 * repeats a short column until it is taller than the wall, so the loop never
 * shows a gap. Until the sizes are known the wall holds its place with
 * placeholders, so nothing reshuffles in front of the reader.
 *
 * Each column is a <MarqueeWall> (the one marquee engine: clone track, fades,
 * off-screen stop, `prefers-reduced-motion`), neighbours travelling opposite ways.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from '../../embed-shims/next-image';
import { cn } from '../../utils/cn';
import { MarqueeWall } from './marquee-wall';

export interface PhotoWallImage {
  url: string;
  alt?: string;
}

export type PhotoOrientation = 'tall' | 'wide' | 'square';

/** The frame each orientation is shown in (width / height). */
export const PHOTO_WALL_FRAME: Record<PhotoOrientation, number> = {
  tall: 4 / 5,
  wide: 16 / 10,
  square: 1,
};

// Natural width / height at or under this is a portrait, at or over the other a landscape.
const TALL_MAX_RATIO = 0.9;
const WIDE_MIN_RATIO = 1.2;
// A picture the browser has neither loaded nor refused by now is laid out as a landscape.
const MEASURE_TIMEOUT_MS = 4000;
const COLUMN_GAP_PX = 12;
// A column is repeated until it is this much taller than the wall.
const FILL_FACTOR = 1.25;
const MAX_REPEATS = 8;

export function photoOrientation(naturalWidth: number, naturalHeight: number): PhotoOrientation {
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) return 'wide';
  const ratio = naturalWidth / naturalHeight;
  if (ratio <= TALL_MAX_RATIO) return 'tall';
  if (ratio >= WIDE_MIN_RATIO) return 'wide';
  return 'square';
}

/**
 * Sort pictures into columns. Pure.
 *
 * The orientations are dealt in turn (the most common one first), so two
 * frames of one shape rarely follow each other; each picture then goes to the
 * column that is shortest so far, so the columns end level. Input order is kept
 * inside an orientation, so a caller's own (random) order still decides WHICH
 * landscape comes first.
 */
export function arrangePhotoWall<T extends { orientation: PhotoOrientation }>(
  photos: ReadonlyArray<T>,
  columnCount: number,
): T[][] {
  const columns: T[][] = Array.from({ length: Math.max(1, columnCount) }, () => []);
  const heights = columns.map(() => 0);
  const buckets: Record<PhotoOrientation, T[]> = { tall: [], wide: [], square: [] };
  for (const photo of photos) buckets[photo.orientation].push(photo);
  const order = (Object.keys(buckets) as PhotoOrientation[])
    .filter(key => buckets[key].length > 0)
    .sort((a, b) => buckets[b].length - buckets[a].length);
  const cursor: Record<PhotoOrientation, number> = { tall: 0, wide: 0, square: 0 };
  let last: PhotoOrientation | null = null;
  for (let placed = 0; placed < photos.length; placed++) {
    // The orientation with the most pictures left, never the one just placed
    // while another still has some.
    const candidates = order.filter(key => cursor[key] < buckets[key].length);
    const pick: PhotoOrientation =
      candidates
        .filter(key => key !== last || candidates.length === 1)
        .sort((a, b) => buckets[b].length - cursor[b] - (buckets[a].length - cursor[a]))[0] ?? candidates[0];
    const photo = buckets[pick][cursor[pick]++];
    last = pick;
    let shortest = 0;
    for (let i = 1; i < heights.length; i++) if (heights[i] < heights[shortest]) shortest = i;
    columns[shortest].push(photo);
    heights[shortest] += 1 / PHOTO_WALL_FRAME[photo.orientation];
  }
  return columns.filter(column => column.length > 0);
}

/** Each url's orientation, once the browser knows its natural size. `null` until every picture answered. */
function usePhotoOrientations(urls: ReadonlyArray<string>): Map<string, PhotoOrientation> | null {
  const key = urls.join('\n');
  const [measured, setMeasured] = useState<{ key: string; byUrl: Map<string, PhotoOrientation> } | null>(null);
  useEffect(() => {
    const list = key ? key.split('\n') : [];
    const byUrl = new Map<string, PhotoOrientation>();
    let done = false;
    let pending = list.length;
    const finish = () => {
      if (done) return;
      done = true;
      for (const url of list) if (!byUrl.has(url)) byUrl.set(url, 'wide');
      setMeasured({ key, byUrl });
    };
    const settle = (url: string, orientation: PhotoOrientation | null) => {
      if (done) return;
      // A picture that cannot load has no place on the wall.
      if (orientation) byUrl.set(url, orientation);
      pending -= 1;
      if (pending === 0) {
        done = true;
        setMeasured({ key, byUrl });
      }
    };
    if (pending === 0) {
      finish();
      return undefined;
    }
    const probes = list.map(url => {
      const probe = new window.Image();
      probe.onload = () => settle(url, photoOrientation(probe.naturalWidth, probe.naturalHeight));
      probe.onerror = () => settle(url, null);
      probe.src = url;
      return probe;
    });
    const timer = window.setTimeout(finish, MEASURE_TIMEOUT_MS);
    return () => {
      done = true;
      window.clearTimeout(timer);
      for (const probe of probes) {
        probe.onload = null;
        probe.onerror = null;
      }
    };
  }, [key]);
  return measured?.key === key ? measured.byUrl : null;
}

export interface PhotoWallProps {
  /** The pictures. Order matters only inside one orientation (see `arrangePhotoWall`). */
  images: ReadonlyArray<PhotoWallImage>;
  /** Columns. Default 2. */
  columns?: number;
  /** Drift speed in px/s (the marquee unit). Default 24. */
  speed?: number;
  /** The surface the top and bottom fades blend into. Default the page background. */
  fadeColor?: string;
  /** Sizing lives here: the wall needs a height (e.g. `h-[420px] md:h-[560px]`). */
  className?: string;
}

export function PhotoWall({ images, columns = 2, speed = 24, fadeColor, className }: PhotoWallProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const read = () => setBox({ width: root.clientWidth, height: root.clientHeight });
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(read);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const urls = useMemo(() => Array.from(new Set(images.map(image => image.url))), [images]);
  const orientations = usePhotoOrientations(urls);

  const layout = useMemo(() => {
    if (!orientations) return null;
    const seen = new Set<string>();
    const photos = images
      .filter(image => orientations.has(image.url) && !seen.has(image.url) && Boolean(seen.add(image.url)))
      .map(image => ({ ...image, orientation: orientations.get(image.url) ?? 'wide' }));
    const arranged = arrangePhotoWall(photos, Math.min(columns, Math.max(1, photos.length)));
    const count = arranged.length || 1;
    const columnWidth = box ? Math.max(1, (box.width - COLUMN_GAP_PX * (count - 1)) / count) : 0;
    return arranged.map(column => {
      if (!box || columnWidth === 0) return column;
      const height = column.reduce(
        (sum, photo) => sum + columnWidth / PHOTO_WALL_FRAME[photo.orientation] + COLUMN_GAP_PX,
        0,
      );
      const repeats = height > 0 ? Math.min(MAX_REPEATS, Math.ceil((box.height * FILL_FACTOR) / height)) : 1;
      return Array.from({ length: Math.max(1, repeats) }, () => column).flat();
    });
  }, [orientations, images, columns, box]);

  if (images.length === 0) return null;

  const gridStyle = { gridTemplateColumns: `repeat(${layout?.length || columns}, minmax(0, 1fr))`, gap: COLUMN_GAP_PX };

  return (
    <div ref={rootRef} aria-hidden="true" className={cn('grid overflow-hidden', className)} style={gridStyle}>
      {layout
        ? layout.map((column, index) => (
            <MarqueeWall
              key={index}
              axis="y"
              reverse={index % 2 === 1}
              // Neighbours drift at slightly different speeds so the frames never line up for long.
              speed={speed * (1 + (index % 2) * 0.15)}
              pauseOnHover={false}
              fade={['top', 'bottom']}
              fadeColor={fadeColor}
              copyGap={COLUMN_GAP_PX}
              className="h-full"
              contentClassName="flex flex-col"
              contentStyle={{ gap: COLUMN_GAP_PX }}
            >
              {column.map((photo, i) => (
                <div
                  key={`${photo.url}-${i}`}
                  className="relative w-full shrink-0 overflow-hidden rounded-lg bg-ods-card"
                  style={{ aspectRatio: PHOTO_WALL_FRAME[photo.orientation] }}
                >
                  <Image
                    src={photo.url}
                    alt={photo.alt ?? ''}
                    fill
                    sizes="(max-width: 768px) 50vw, 360px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ))}
            </MarqueeWall>
          ))
        : Array.from({ length: columns }, (_, index) => (
            <div
              key={index}
              className="flex h-full animate-pulse flex-col overflow-hidden"
              style={{ gap: COLUMN_GAP_PX }}
            >
              {(index % 2 === 0 ? (['tall', 'wide', 'square'] as const) : (['wide', 'tall', 'wide'] as const)).map(
                (orientation, i) => (
                  <div
                    key={i}
                    className="w-full shrink-0 rounded-lg bg-ods-card"
                    style={{ aspectRatio: PHOTO_WALL_FRAME[orientation] }}
                  />
                ),
              )}
            </div>
          ))}
    </div>
  );
}
