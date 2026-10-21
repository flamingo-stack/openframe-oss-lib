'use client';

import { type HTMLAttributes, memo, forwardRef } from 'react';
import Image from '../../embed-shims/next-image';
import { useAuthedImageSrc } from '../../hooks/use-authed-image-src';
import { AVATAR_SIZE, AVATAR_SIZE_PX } from '../../styles/component-sizes';
import { cn } from '../../utils/cn';
import { personInitials } from '../../utils/format';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { loadingItemProps, useLoadingScope } from './loading-scope';

interface SquareAvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  /** A step of the shared avatar scale (`AVATAR_SIZE`). */
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
  /** The person is still being read: the avatar draws its skeleton (its own size and corner) and fetches no image.
   *  A loading scope does the same. */
  loading?: boolean;
}

/** The avatar's corner at each variant, read by the avatar and by its skeleton. */
const SQUARE_AVATAR_VARIANT_CLASS = {
  square: 'rounded-md',
  round: 'rounded-full',
} as const;

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
        loading,
        style,
        ...props
      },
      ref,
    ) => {
      // ONE switch: while the host reads the person, or in a loading scope, the avatar is its skeleton, and its image
      // is not fetched.
      const inScope = useLoadingScope();
      const held = inScope || !!loading;
      const authedSrc = useAuthedImageSrc(held ? undefined : src);
      if (held) {
        return (
          <SquareAvatarSkeleton
            size={size}
            sizePx={sizePx}
            variant={variant}
            className={className}
            {...loadingItemProps(props)}
          />
        );
      }
      const resolvedSrc = authedSrc;
      const sizeClasses = AVATAR_SIZE;
      const sizePxBySize = AVATAR_SIZE_PX;

      const variantClasses = SQUARE_AVATAR_VARIANT_CLASS;

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

/** A SquareAvatar while its person is read: a box of the avatar's own size and corner. */
export function SquareAvatarSkeleton({
  size = 'md',
  sizePx,
  variant = 'square',
  className,
  ...props
}: Pick<SquareAvatarProps, 'size' | 'sizePx' | 'variant' | 'className'> & {
  /** The avatar's markers (`data-loading-item`), forwarded like the loaded avatar's. */
  [marker: `data-${string}`]: unknown;
}) {
  return (
    <UnifiedSkeleton
      {...loadingItemProps(props)}
      className={cn(
        'shrink-0',
        sizePx === undefined && AVATAR_SIZE[size],
        SQUARE_AVATAR_VARIANT_CLASS[variant],
        className,
      )}
      width={sizePx}
      height={sizePx}
    />
  );
}
