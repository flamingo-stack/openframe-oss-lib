import type React from 'react';
import { cn } from '../../utils/cn';
import { SKELETON_SURFACE_CLASS } from '../ui/skeleton-surface';

interface UnifiedSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: 'default' | 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  /**
   * Disable animation for users who prefer reduced motion
   */
  animate?: boolean;
  /**
   * Names what is loading for screen readers. Only a bar that stands alone sets it: it then becomes a
   * `role="status"`. Without it the bar is `aria-hidden`, and its `LoadingRegion` announces the loading once.
   */
  'aria-label'?: string;
  /**
   * The element drawn. `span` keeps the placeholder valid phrasing content where
   * a `div` may not stand (inside a `p`, a heading, a label or an inline card).
   * A span bar whose classes set no base display gets one of its own, capped to
   * its line and centred on it; a caller that sets one gets none of the three.
   */
  as?: 'div' | 'span';
}

/**
 * UnifiedSkeleton Component
 *
 * Base skeleton component with consistent styling across the application.
 *
 * Design Specifications:
 * - Color: #2A2A2A base with #3A3A3A pulse highlight
 * - Animation: 1.5s pulse duration, ease-in-out timing
 * - Responsive: Mobile-first approach with proper scaling
 * - Accessibility: hidden from assistive technology (the `LoadingRegion` around it announces), reduced motion support
 *
 * @param variant - Shape variant: default (rounded), text (rounded-sm), circular, rectangular
 * @param width - Custom width (defaults to full width)
 * @param height - Custom height (defaults to auto based on variant)
 * @param animate - Enable/disable animation (respects prefers-reduced-motion)
 * @param aria-label - Makes this one bar a `role="status"` with that name; otherwise it is `aria-hidden`
 * @param as - The element drawn: `div` (default) or `span` for phrasing content
 */
export function UnifiedSkeleton({
  className,
  variant = 'default',
  width,
  height,
  animate = true,
  'aria-label': ariaLabel,
  as: Tag = 'div',
  ...props
}: UnifiedSkeletonProps) {
  const variantClasses = {
    default: 'rounded-md',
    text: 'rounded-sm',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
  };

  const defaultHeights = {
    default: 'h-4',
    text: 'h-4',
    circular: 'h-12 w-12',
    rectangular: 'h-4',
  };

  // An `aspect-*` utility sizes the box itself; a default height would win
  // over it (explicit height beats aspect-ratio) and collapse the box to 16px.
  const sizedByAspect = /(?:^|\s)aspect-/.test(className ?? '');
  // A span that already names its base display keeps it, with its own cap and alignment: the frozen
  // TitleBlock's bars and the chip and breadcrumb skeletons are `inline-block` on the baseline, tuned to
  // their text. Only an unprefixed display counts: `md:hidden` leaves the base span inline, and a bar
  // without the default would draw at 0×0 below that breakpoint. The list is the displays bars use;
  // any other falls back to the default, and twMerge still lets the caller's display win.
  const setsDisplay =
    /(?:^|\s)(?:inline-block|inline-flex|inline-grid|inline|block|flex|grid|contents|hidden)(?=\s|$)/.test(
      className ?? '',
    );

  const style: React.CSSProperties = {
    width: width,
    height: height,
  };

  return (
    <Tag
      className={cn(
        // An inline span ignores width and height: without a display of its own the bar draws at 0×0.
        Tag === 'span' && !setsDisplay && 'inline-block max-w-full align-middle',
        animate ? SKELETON_SURFACE_CLASS : 'bg-ods-skeleton',
        variantClasses[variant],
        !height && !style.height && !sizedByAspect && defaultHeights[variant],
        !width && !style.width && variant !== 'circular' && 'w-full',
        className,
      )}
      style={style}
      // A bar is decoration: hidden from assistive technology unless the caller names what is loading.
      // The loading CONTAINER says it once (`LoadingRegion`: aria-busy plus one polite status).
      {...(ariaLabel ? { role: 'status', 'aria-label': ariaLabel } : { 'aria-hidden': true })}
      {...props}
    />
  );
}

/**
 * Text skeleton variants for consistent typography loading
 */
export const TextSkeleton = {
  /**
   * Large heading skeleton (h1, h2)
   */
  Heading: ({ className, ...props }: Omit<UnifiedSkeletonProps, 'variant'>) => (
    <UnifiedSkeleton variant="text" className={cn('h-8 content-md:h-10 content-lg:h-12', className)} {...props} />
  ),

  /**
   * Medium heading skeleton (h3, h4)
   */
  Subheading: ({ className, ...props }: Omit<UnifiedSkeletonProps, 'variant'>) => (
    <UnifiedSkeleton variant="text" className={cn('h-6 content-md:h-7 content-lg:h-8', className)} {...props} />
  ),

  /**
   * Body text skeleton
   */
  Body: ({ className, ...props }: Omit<UnifiedSkeletonProps, 'variant'>) => (
    <UnifiedSkeleton variant="text" className={cn('h-4 content-md:h-5', className)} {...props} />
  ),

  /**
   * Small text skeleton (captions, metadata)
   */
  Caption: ({ className, ...props }: Omit<UnifiedSkeletonProps, 'variant'>) => (
    <UnifiedSkeleton variant="text" className={cn('h-3 content-md:h-4', className)} {...props} />
  ),
};

/**
 * Interactive element skeletons
 */
export const InteractiveSkeleton = {
  /**
   * Button skeleton with proper touch targets
   */
  Button: ({ className, ...props }: Omit<UnifiedSkeletonProps, 'variant'>) => (
    <UnifiedSkeleton
      variant="default"
      className={cn('h-10 w-32 content-md:h-12 content-md:w-40', className)}
      {...props}
    />
  ),

  /**
   * Input field skeleton
   */
  Input: ({ className, ...props }: Omit<UnifiedSkeletonProps, 'variant'>) => (
    <UnifiedSkeleton variant="default" className={cn('h-10 w-full content-md:h-12', className)} {...props} />
  ),

  /**
   * Filter chip skeleton
   */
  Chip: ({ className, ...props }: Omit<UnifiedSkeletonProps, 'variant'>) => (
    <UnifiedSkeleton variant="default" className={cn('h-8 w-20 rounded-full', className)} {...props} />
  ),
};

/**
 * Media skeletons for images and icons
 */
export const MediaSkeleton = {
  /**
   * Avatar/profile image skeleton
   */
  Avatar: ({
    size = 'md',
    className,
    ...props
  }: Omit<UnifiedSkeletonProps, 'variant'> & { size?: 'sm' | 'md' | 'lg' }) => {
    const sizeClasses = {
      sm: 'h-8 w-8',
      md: 'h-12 w-12',
      lg: 'h-16 w-16',
    };

    return <UnifiedSkeleton variant="circular" className={cn(sizeClasses[size], className)} {...props} />;
  },

  /**
   * Card image skeleton (1200×630 OG aspect — matches entity-cards default
   * so loading state never causes a height shift when card data arrives)
   */
  CardImage: ({ className, ...props }: Omit<UnifiedSkeletonProps, 'variant'>) => (
    <UnifiedSkeleton variant="default" className={cn('aspect-[1200/630] w-full', className)} {...props} />
  ),

  /**
   * Icon skeleton
   */
  Icon: ({
    size = 'md',
    className,
    ...props
  }: Omit<UnifiedSkeletonProps, 'variant'> & { size?: 'sm' | 'md' | 'lg' }) => {
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-6 w-6',
      lg: 'h-8 w-8',
    };

    return <UnifiedSkeleton variant="default" className={cn(sizeClasses[size], className)} {...props} />;
  },
};
