'use client'

import React from 'react'

interface BlogImagePlaceholderProps {
  /** Cover-image URL. The hub passes a `useOgPlaceholderUrl({ title, siteName })`
   *  result; embedders pass their own pre-resolved URL. When null, the
   *  component renders nothing. */
  imageUrl: string | null
  /** Used for the `alt` attribute. */
  title: string
  className?: string
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
export function BlogImagePlaceholder({
  imageUrl,
  title,
  className = '',
}: BlogImagePlaceholderProps) {
  if (!imageUrl) return null

  return (
    <span className={`relative block w-full h-full overflow-hidden bg-ods-bg ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- this is a
          dynamically-generated placeholder image with a query string;
          next/image's loader configuration adds nothing here. */}
      <img
        src={imageUrl}
        alt={`Cover image for ${title}`}
        className="block w-full h-full object-contain"
        loading="lazy"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none'
        }}
      />
    </span>
  )
}
