'use client'

import React from 'react'
import { cn } from '../../utils/cn'

function getInitials(name?: string): string {
  if (!name) return ''
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase()
}

export interface EntityImageProps {
  src?: string | null
  alt?: string
  /** Overrides the initials source. Defaults to `alt`. */
  fallbackText?: string
  className?: string
}

export function EntityImage({ src, alt, fallbackText, className }: EntityImageProps) {
  const [imageFailed, setImageFailed] = React.useState(false)

  React.useEffect(() => {
    setImageFailed(false)
  }, [src])

  const showFallback = imageFailed || !src
  const initials = getInitials(fallbackText ?? alt)

  if (showFallback) {
    return (
      <div
        aria-label={alt}
        className={cn(
          'size-[52px] md:size-[60px] shrink-0 rounded-md border border-ods-border bg-ods-bg flex items-center justify-center text-ods-text-secondary text-h4 select-none',
          className,
        )}
      >
        {initials || '?'}
      </div>
    )
  }

  return (
    <img
      src={src ?? undefined}
      alt={alt ?? ''}
      onError={() => setImageFailed(true)}
      className={cn(
        'size-[52px] md:size-[60px] shrink-0 rounded-md border border-ods-border object-contain',
        className,
      )}
    />
  )
}
