'use client';

import React from 'react';
import Image from '../../embed-shims/next-image';
import { useAuthedImageSrc } from '../../hooks/use-authed-image-src';
import { cn } from '../../utils/cn';
import { personInitials } from '../../utils/format';

export interface EntityImageProps {
  src?: string | null;
  alt?: string;
  /** Overrides the initials source. Defaults to `alt`. */
  fallbackText?: string;
  className?: string;
}

export function EntityImage({ src, alt, fallbackText, className }: EntityImageProps) {
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
          'flex size-[52px] shrink-0 select-none items-center justify-center rounded-md border border-ods-border bg-ods-bg text-ods-text-secondary text-h4 md:size-[60px]',
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
        'size-[52px] shrink-0 rounded-md border border-ods-border object-contain md:size-[60px]',
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
