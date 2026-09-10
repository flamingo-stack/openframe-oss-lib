'use client';

import React from 'react';
import Image from '../../embed-shims/next-image';
import { useAuthedImageSrc } from '../../hooks/use-authed-image-src';
import { cn } from '../../utils/cn';
import { personInitials } from '../../utils/format';

/** The design size, when a caller does not state one. */
const ENTITY_IMAGE_SIZE = 'size-[52px] md:size-[60px]';

export interface EntityImageProps {
  src?: string | null;
  alt?: string;
  /** Overrides the initials source. Defaults to `alt`. */
  fallbackText?: string;
  /**
   * REPLACES the default size, for both the image and its initials fallback.
   *
   * Sizing through `className` does NOT work here and cannot be made to:
   * the default is responsive (`size-[52px] md:size-[60px]`), and
   * tailwind-merge lets `size-*` override `w`/`h` but never the reverse — so a
   * caller passing `h-4 w-6` dropped the base `size-[52px]` and kept
   * `md:size-[60px]`, rendering 16px on a phone and 60px on a desktop. State
   * the size here instead; it is substituted, not merged.
   */
  sizeClassName?: string;
  className?: string;
}

export function EntityImage({ src, alt, fallbackText, sizeClassName, className }: EntityImageProps) {
  const resolvedSrc = useAuthedImageSrc(src);
  // Which src failed, rather than a bare "failed" flag reset from an effect on
  // every src change. The reset is then implicit — a new src simply is not the
  // one that failed — so the fallback initials never survive into the render
  // that swapped the image, and a new src costs no second render pass.
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const imageFailed = resolvedSrc !== undefined && failedSrc === resolvedSrc;

  const showFallback = imageFailed || !resolvedSrc;
  const initials = personInitials(fallbackText ?? alt);

  if (showFallback) {
    return (
      <div
        aria-label={alt}
        className={cn(
          'flex shrink-0 select-none items-center justify-center rounded-md border border-ods-border bg-ods-bg text-ods-text-secondary text-h4',
          sizeClassName ?? ENTITY_IMAGE_SIZE,
          className,
        )}
      >
        {initials || '?'}
      </div>
    );
  }

  return (
    <Image
      src={resolvedSrc}
      alt={alt ?? ''}
      onError={() => setFailedSrc(resolvedSrc)}
      className={cn(
        'shrink-0 rounded-md border border-ods-border object-contain',
        sizeClassName ?? ENTITY_IMAGE_SIZE,
        className,
      )}
      // Intrinsic hint only — the responsive `size-*` classes above own the
      // rendered box. `unoptimized` because `useAuthedImageSrc` hands back a
      // `blob:` URL under bearer-token hosts, which no image optimizer can fetch.
      width={60}
      height={60}
      unoptimized
    />
  );
}
