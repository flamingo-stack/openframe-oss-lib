'use client';

/**
 * A poster drawn on a `<canvas>`: how every hover-preview surface shows its
 * picture (`VideoHoverPreviewSurface`: the walkthrough card, the video bites
 * strip, the case-study card).
 *
 * Why not an image: Largest Contentful Paint keeps taking candidates until the
 * visitor's first scroll, tap or key press, and an element that paints late and
 * is the largest thing in the viewport becomes the page's LCP at that moment.
 * The floating walkthrough card's poster did exactly that in a short window
 * (blog post, 1440x215: LCP moved from the heading at 3.2 s to the poster at
 * 7.1 s). An `<img>`, a CSS `background-image`, a video poster and a video's
 * first frame are all candidates; a canvas is not one (measured in Chrome; it
 * is not among the element types the metric reads). A preview poster is a
 * teaser for a video, never the page's main content, so none of them may set
 * the page's LCP.
 *
 * The picture is fetched about as wide as the box is drawn (the host's
 * resizer, `resizedImageUrl`) and drawn cover-fit, centred. It is fetched once
 * the box has a size and drawn again when the box changes size.
 */

import { useEffect, useRef } from 'react';

import { resizedImageUrl } from '../../embed-shims/next-image';
import { cn } from '../../utils/cn';

/** A sharper canvas than this costs pixels nobody can tell apart at card size. */
const MAX_PIXEL_RATIO = 2;

export interface CanvasPosterProps {
  src: string;
  /** The picture could not be loaded (wire to the cover-fallback chain). */
  onError?: () => void;
  className?: string;
}

export function CanvasPoster({ src, onError, className }: CanvasPosterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The latest handler, so a new function identity never re-fetches the picture.
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let cancelled = false;
    let picture: HTMLImageElement | null = null;
    let loaded = false;

    const draw = () => {
      if (cancelled || !picture || !loaded || !picture.naturalWidth || !picture.naturalHeight) return;
      const box = canvas.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const width = Math.round(box.width * ratio);
      const height = Math.round(box.height * ratio);
      const context = canvas.getContext('2d');
      if (!context) return;
      // Setting a canvas's size clears it, so only when the size really changed.
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      // object-fit: cover, centred.
      const scale = Math.max(width / picture.naturalWidth, height / picture.naturalHeight);
      const drawnWidth = picture.naturalWidth * scale;
      const drawnHeight = picture.naturalHeight * scale;
      context.drawImage(picture, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
    };

    const load = (boxWidth: number) => {
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      picture = new window.Image();
      picture.decoding = 'async';
      picture.onload = () => {
        loaded = true;
        draw();
      };
      picture.onerror = () => {
        if (!cancelled) onErrorRef.current?.();
      };
      picture.src = resizedImageUrl(src, Math.round(boxWidth * ratio));
    };

    // The box may have no size yet (a hidden strip, a collapsed cell): the picture
    // is fetched when it first has one, and drawn again whenever it changes.
    const onBox = () => {
      const { width } = canvas.getBoundingClientRect();
      if (!width) return;
      if (!picture) load(width);
      else draw();
    };
    onBox();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(onBox) : null;
    observer?.observe(canvas);

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (picture) {
        picture.onload = null;
        picture.onerror = null;
      }
    };
  }, [src]);

  // Decorative, like the image it replaced (`alt=""`).
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-testid="canvas-poster"
      className={cn('absolute inset-0 h-full w-full', className)}
    />
  );
}
