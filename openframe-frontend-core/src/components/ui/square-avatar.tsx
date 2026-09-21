'use client';

import { type HTMLAttributes, memo, forwardRef } from 'react';
import Image from '../../embed-shims/next-image';
import { useAuthedImageSrc } from '../../hooks/use-authed-image-src';
import { cn } from '../../utils/cn';
import { personInitials } from '../../utils/format';

interface SquareAvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Exact pixel size (width & height). Overrides the `size` bucket dimensions —
   *  for callers with a numeric-px API (e.g. UserDisplay/MSPDisplay). */
  sizePx?: number;
  /**
   * How the image fills the frame. `cover` (default) crops to fill — right for
   * a portrait. `contain` fits the whole image — required for a LOGO or club
   * crest, whose round border cover slices off.
   */
  fit?: 'cover' | 'contain';
  fallback?: string;
  variant?: 'square' | 'round';
  /** Override the initials-fallback styling (font size/color). Merged over the
   *  defaults (`text-xs font-medium text-ods-text-primary`) via tailwind-merge,
   *  so callers can shrink/recolor the initials for compact avatars. */
  initialsClassName?: string;
}

const SquareAvatar = memo(
  forwardRef<HTMLDivElement, SquareAvatarProps>(
    (
      {
        className,
        src,
        alt,
        size = 'md',
        sizePx,
        fit = 'cover',
        fallback,
        variant = 'square',
        initialsClassName,
        style,
        ...props
      },
      ref,
    ) => {
      const resolvedSrc = useAuthedImageSrc(src);
      const sizeClasses = {
        // xs (24px): dense card meta rows — avatar stacks on delivery/
        // roadmap cards. Part of the shared scale so no caller ever
        // bypasses the buckets with raw sizePx for a standard size.
        xs: 'h-6 w-6',
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
        lg: 'h-12 w-12',
        xl: 'h-16 w-16',
      };

      const sizePxBySize = {
        xs: 24,
        sm: 32,
        md: 40,
        lg: 48,
        xl: 64,
      };

      const variantClasses = {
        square: 'rounded-md',
        round: 'rounded-full',
      };

      return (
        <div
          className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden border border-ods-border bg-ods-bg',
            sizePx === undefined && sizeClasses[size],
            variantClasses[variant],
            className,
          )}
          style={sizePx === undefined ? style : { width: sizePx, height: sizePx, ...style }}
          ref={ref}
          {...props}
        >
          <div
            className={cn(
              // Initials default to `--color-text-primary` (the old
              // `text-ods-text-primary` value) so they stay readable on the default
              // `bg-ods-bg` AND on the brand accent fills (`bg-ods-flamingo-pink`
              // for the current user, `bg-ods-flamingo-cyan` for Mingo). The color
              // resolves through `--ods-avatar-initials` with that fallback, so a
              // host themed with a custom avatar fill can override the var with a
              // contrast-correct value (e.g. `getReadableTextColor(accent)`) WITHOUT
              // regressing any avatar that leaves the var unset. A caller passing
              // its own `initialsClassName` text color still wins (tailwind-merge
              // keeps the later class).
              'flex items-center justify-center text-xs font-medium text-[color:var(--ods-avatar-initials,var(--color-text-primary))]',
              initialsClassName,
              resolvedSrc && 'hidden',
            )}
          >
            {personInitials(fallback || alt) || '?'}
          </div>
          {resolvedSrc && (
            <Image
              className={cn(
                'absolute max-w-none',
                fit === 'contain'
                  ? // A LOGO or crest must fit whole; cover would slice its edges.
                    'inset-0 h-full w-full object-contain'
                  : // A portrait fills the frame; the 1px overscan hides edge seams.
                    '-inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] object-cover',
              )}
              // Images are draggable by default, and a draggable child WINS over a
              // draggable ancestor: an avatar inside a drag-and-drop card lets the
              // browser start its own "drag this picture" instead of the card's
              // drag, so grabbing a card by its assignee did nothing.
              draggable={false}
              src={resolvedSrc}
              alt={alt || ''}
              width={sizePx ?? sizePxBySize[size]}
              height={sizePx ?? sizePxBySize[size]}
              onError={e => {
                const img = e.currentTarget;
                img.style.display = 'none';
                const el = img.previousElementSibling as HTMLElement;
                if (el) el.classList.remove('hidden');
              }}
            />
          )}
        </div>
      );
    },
  ),
);
SquareAvatar.displayName = 'SquareAvatar';

export { SquareAvatar };
