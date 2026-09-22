'use client';

import Image from '../../../embed-shims/next-image';

interface BlogImagePlaceholderProps {
  /** Cover-image URL. The hub passes a `useOgPlaceholderUrl({ title, siteName })`
   *  result; embedders pass their own pre-resolved URL. When null, the
   *  component renders nothing. */
  imageUrl: string | null;
  /** Used for the `alt` attribute. */
  title: string;
  className?: string;
}

/**
 * Pure presentation wrapper for a cover-image / OG-placeholder fallback.
 *
 * Outer must be inline-content-model so this placeholder is HTML-valid
 * when rendered inside a markdown `<p>` (e.g. via the chat shell's
 * compact `BlogCard` fallback). `<span className="block">` keeps the
 * same visual behavior as the prior `<div>` while satisfying the
 * phrasing-content constraint of its parent.
 *
 * If the `imageUrl` itself 404s (cold cache, transient failure), the
 * `onError` handler hides the broken-image icon so the parent's
 * `bg-ods-bg` shows through cleanly. Same recovery pattern every
 * cover-image render path uses.
 */
export function BlogImagePlaceholder({ imageUrl, title, className = '' }: BlogImagePlaceholderProps) {
  if (!imageUrl) return null;

  return (
    <span className={`relative block h-full w-full overflow-hidden bg-ods-bg ${className}`}>
      <Image
        src={imageUrl}
        alt={`Cover image for ${title}`}
        className="object-contain"
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        unoptimized
        loading="lazy"
        onError={e => {
          const img = e.currentTarget;
          img.style.display = 'none';
        }}
      />
    </span>
  );
}
