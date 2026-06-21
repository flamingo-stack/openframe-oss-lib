'use client';

import { useEffect, useState } from 'react';
import Image from '../../embed-shims/next-image';
import { useRichMarkdownRuntime } from './rich-markdown-runtime';

/**
 * In-article markdown image.
 *
 * Markdown images have unknown intrinsic dimensions — which is what broke the old
 * approach: a fixed width/height made the Supabase loader `resize=cover` CROP tall
 * screenshots, and `w-full` then blew them up to the column width. This renders
 * through the lib's `next/image` shim (full Next.js Image Optimization on the hub,
 * plain `<img>` everywhere else) and fixes both problems at the source:
 *
 *   - `object-contain` flips the hub's Supabase loader (injected via
 *     `transformImageSrc` from the {@link RichMarkdownRuntimeProvider}) to
 *     `resize=contain` — aspect preserved, never cropped.
 *   - We learn the real aspect ratio from a tiny probe (the same
 *     `transformImageSrc` at 48px when available) and pass matching width/height
 *     so `next/image`'s aspect-ratio box is correct.
 *   - CSS (`max-w-full` + `max-h` + auto) caps the on-page size so a tall
 *     screenshot can't dominate the article, while the browser keeps the true
 *     aspect ratio.
 *
 * Embedders that don't pass `transformImageSrc` get an identity fallback — the
 * raw `src` is used both for the probe and the display copy.
 */
const MAX_H_REM = 32; // ~512px on-page cap
const DISPLAY_W = 768; // logical width hint; the optimizer handles srcset + retina

export function MarkdownImage({ src, alt }: { src: string; alt?: string }) {
  const { transformImageSrc } = useRichMarkdownRuntime();
  const [ratio, setRatio] = useState<number | null>(null); // width / height

  useEffect(() => {
    let cancelled = false;
    // Reset on src change so a reused instance doesn't briefly size the new image with
    // the previous image's ratio.
    setRatio(null);
    // Probe a tiny aspect-preserving variant so we learn the real ratio without
    // downloading the full image; the display copy is then fetched once, at the right size.
    // When no transformer is wired (embedders), fall back to the raw src.
    const probeSrc = transformImageSrc(src, { width: 48, resize: 'contain', quality: 20 }) ?? src;
    const probe = new window.Image();
    probe.onload = () => {
      if (!cancelled && probe.naturalWidth && probe.naturalHeight) {
        setRatio(probe.naturalWidth / probe.naturalHeight);
      }
    };
    probe.onerror = () => {
      if (!cancelled) setRatio(1.5); // neutral fallback so we still render something
    };
    probe.src = probeSrc;
    return () => {
      cancelled = true;
    };
  }, [src, transformImageSrc]);

  // Reserve a neutral box while probing so the layout doesn't jump when the image appears.
  if (!ratio) {
    return (
      <span
        className="mx-auto my-2 block w-full max-w-full animate-pulse rounded-lg bg-ods-card"
        style={{ aspectRatio: '3 / 2', maxHeight: `${MAX_H_REM}rem` }}
        aria-hidden
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt ?? 'No image available'}
      width={DISPLAY_W}
      height={Math.round(DISPLAY_W / ratio)}
      sizes="(max-width: 768px) 100vw, 768px"
      loading="lazy"
      // `object-contain` → SupabaseOptimizedImage uses `resize=contain` (no crop).
      // `w-full` (not `w-auto`) gives the img a definite width so it lays out + lazy-loads
      // even before decode. Height follows via the aspect-ratio box; `maxHeight` caps tall
      // images and `maxWidth = maxHeight × ratio` shrinks the width in lockstep so the box
      // stays snug to the image (no letterbox bars).
      className="mx-auto my-2 block h-auto w-full rounded-lg object-contain"
      style={{ maxWidth: `calc(${MAX_H_REM}rem * ${ratio})`, maxHeight: `${MAX_H_REM}rem` }}
    />
  );
}
