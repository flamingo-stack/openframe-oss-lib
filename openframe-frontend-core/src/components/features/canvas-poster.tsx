'use client';

/**
 * A poster drawn on a `<canvas>`, for a surface that arrives LATE and uninvited
 * (the floating walkthrough card, shown seconds after load).
 *
 * Why not an image: Largest Contentful Paint keeps taking candidates until the
 * visitor's first scroll, tap or key press, and a late element that is the
 * largest thing in the viewport becomes the page's LCP at the moment it paints.
 * In a short window the card's poster did exactly that (blog post, 1440x215:
 * LCP moved from the heading at 3.2 s to the poster at 7.1 s). An `<img>`, a
 * CSS `background-image`, a video poster and a video's first frame are all
 * candidates; a canvas is not one (measured in Chrome; it is not among the
 * element types the metric reads). The picture is the same, the page's metric
 * stays the page's.
 *
 * The picture is fetched about as wide as the box is drawn (the host's
 * resizer, `resizedImageUrl`) and drawn cover-fit, centred.
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
    const box = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const width = Math.max(1, Math.round(box.width * ratio));
    const height = Math.max(1, Math.round(box.height * ratio));

    let cancelled = false;
    const picture = new window.Image();
    picture.decoding = 'async';
    picture.onload = () => {
      if (cancelled) return;
      const context = canvas.getContext('2d');
      if (!context || !picture.naturalWidth || !picture.naturalHeight) return;
      canvas.width = width;
      canvas.height = height;
      // object-fit: cover, centred.
      const scale = Math.max(width / picture.naturalWidth, height / picture.naturalHeight);
      const drawnWidth = picture.naturalWidth * scale;
      const drawnHeight = picture.naturalHeight * scale;
      context.drawImage(picture, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
    };
    picture.onerror = () => {
      if (!cancelled) onErrorRef.current?.();
    };
    picture.src = resizedImageUrl(src, width);
    return () => {
      cancelled = true;
      picture.onload = null;
      picture.onerror = null;
    };
  }, [src]);

  // Decorative, like the image it stands in for (`alt=""`).
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-testid="canvas-poster"
      className={cn('absolute inset-0 h-full w-full', className)}
    />
  );
}
