"use client";

import React from 'react';
import { cn } from "../utils/cn";
import { getProxiedImageUrl } from '../utils/image-proxy';

interface SquareAvatarProps {
  /** Image URL (if null/undefined, renders initials fallback) */
  src?: string | null;
  /** Fallback name used to derive initials when no image */
  fallbackName?: string;
  /** Size in px (applied to width & height). Defaults to 56 (Tailwind w-14 h-14). */
  size?: number;
  /** If true, avatar takes full width with square aspect ratio */
  fullWidth?: boolean;
  className?: string;
}

/**
 * Square avatar with rounded edges used across cards / dashboards.
 * Automatically shows image (via proxied URL) or initials fallback.
 */
export function SquareAvatar({ src, fallbackName = '', size = 56, fullWidth = false, className }: SquareAvatarProps) {
  const initials = React.useMemo(() => {
    if (!fallbackName) return '';
    return fallbackName
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [fallbackName]);

  const style: React.CSSProperties = fullWidth ? {} : { width: size, height: size };

  return (
    <div
      className={cn(
        'rounded-lg border border-ods-border flex items-center justify-center overflow-hidden bg-ods-bg-secondary',
        fullWidth ? 'w-full aspect-square' : 'flex-shrink-0',
        className,
      )}
      style={style}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={getProxiedImageUrl(src) || src} alt="Avatar" className="object-cover w-full h-full" />
      ) : (
        <span className={cn(
          "font-['DM_Sans'] text-ods-text-primary font-bold",
          fullWidth ? 'text-4xl' : 'text-lg'
        )}>
          {initials}
        </span>
      )}
    </div>
  );
} 