import type React from 'react';
import { cn } from '../../utils/cn';
import { BUTTON_SIZE_CLASS, type ButtonSizeKey } from '../ui/button/button-styles';
import { INPUT_HEIGHT_CLASS, INPUT_RADIUS_CLASS } from '../ui/input-styles';
import { SKELETON_SURFACE_CLASS } from '../ui/skeleton-surface';

interface UnifiedSkeletonProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /**
   * A skeleton is a shape, never a frame: it takes no children, so nothing (another skeleton above all) is ever
   * drawn inside its pulsing surface.
   */
  children?: never;
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
 * - Surface: `SKELETON_SURFACE_CLASS` (`ui/skeleton-surface.ts`), the ONE skeleton surface: the ODS skeleton token
 *   and the ONE pulse every loading state shares. Never a second colour, duration or animation.
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

  // The caller's style is kept (a held image's aspect ratio); the width and height props win where given.
  const style: React.CSSProperties = {
    ...props.style,
    ...(width !== undefined && { width }),
    ...(height !== undefined && { height }),
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
      // A bar is decoration: hidden from assistive technology unless the caller names what is loading.
      // The loading CONTAINER says it once (`LoadingRegion`: aria-busy plus one polite status).
      {...(ariaLabel ? { role: 'status', 'aria-label': ariaLabel } : { 'aria-hidden': true })}
      {...props}
      style={style}
    />
  );
}

/**
 * The ODS type steps a text line can take, as static classes (a class built at runtime emits no CSS). `inherit` sets
 * no type of its own: the bar takes the line height of the element it sits in (a row sized by its caller).
 */
const TEXT_LINE_TYPE = {
  h1: 'text-h1',
  h2: 'text-h2',
  h3: 'text-h3',
  h4: 'text-h4',
  h5: 'text-h5',
  h6: 'text-h6',
  code: 'text-code',
  inherit: '',
} as const;
const TEXT_LINE_HEIGHT: Record<number, string> = {
  1: 'h-[1lh]',
  2: 'h-[2lh]',
  3: 'h-[3lh]',
  4: 'h-[4lh]',
  5: 'h-[5lh]',
  6: 'h-[6lh]',
};

export type TextLineType = keyof typeof TEXT_LINE_TYPE;

export interface TextLineSkeletonProps {
  /** The type step of the text the bar stands for (`inherit`: the surrounding element's). */
  type: TextLineType;
  /** How many lines the text takes (1 by default). Past 6, the height is set inline in `lh`. */
  lines?: number;
  /**
   * `span` for a bar inside phrasing content (a `<p>`, a heading, a label): a `<div>` there is invalid HTML, and
   * the browser's parser closes the `<p>` around it, adding empty paragraphs that take a flex gap each.
   */
  as?: 'div' | 'span';
  /**
   * The bar's width as an inline style, for a width a static class cannot state (a `ch` count per item: `'12ch'`).
   * A class in `className` is the usual way.
   */
  width?: string | number;
  className?: string;
}

/**
 * THE text bar: a run of text lines while it loads. The bar takes the type step the loaded text uses and `lines` of
 * its line height (`lh`), so the loaded text takes its place at every breakpoint without moving the page. Never
 * rebuild it as a `UnifiedSkeleton` with `h-[1lh]`.
 */
export function TextLineSkeleton({ type, lines = 1, as = 'div', width, className }: TextLineSkeletonProps) {
  const Tag = as;
  const heightClass = TEXT_LINE_HEIGHT[lines];
  // A run of separate lines, like the text it stands for: each line is one line-height row holding a bar narrower
  // than the row (the gap between bars is the leading), and a paragraph's last line is shorter. The box is exactly
  // `lines` line heights, so the loaded text takes its place without moving the page.
  return (
    <Tag
      aria-hidden="true"
      className={cn('flex flex-col', TEXT_LINE_TYPE[type], heightClass, className)}
      style={heightClass && width === undefined ? undefined : { height: heightClass ? undefined : `${lines}lh`, width }}
    >
      {Array.from({ length: lines }, (_, index) => (
        <Tag key={index} className="flex h-[1lh] items-center">
          <UnifiedSkeleton
            as={as}
            className={cn('block h-[0.7lh] rounded', lines > 1 && index === lines - 1 ? 'w-3/5' : 'w-full')}
          />
        </Tag>
      ))}
    </Tag>
  );
}

/**
 * Text skeleton variants at fixed heights. A skeleton that must take exactly
 * the space of the text it stands for (a card whose loaded and loading boxes
 * are one size) is `TextLineSkeleton`, sized by the text's own type step.
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
/** The width a button skeleton stands for its label with (a short label). */
const BUTTON_SKELETON_LABEL_WIDTH_CLASS = 'w-24';

export const InteractiveSkeleton = {
  /**
   * A button while its label is read (or a whole button row in a skeleton): the box is that Button size's own
   * classes (`BUTTON_SIZE_CLASS`, the same map `buttonVariants` reads: height and padding per breakpoint; the
   * `default` size when none is given, as `Button`'s own default) and a width standing for the label (`className`
   * overrides it); icon sizes carry their own width.
   */
  Button: ({
    className,
    size = 'default',
    ...props
  }: Omit<UnifiedSkeletonProps, 'variant'> & { size?: ButtonSizeKey }) => (
    <UnifiedSkeleton
      variant="default"
      className={cn(BUTTON_SIZE_CLASS[size], !size.startsWith('icon') && BUTTON_SKELETON_LABEL_WIDTH_CLASS, className)}
      {...props}
    />
  ),

  /**
   * Input field skeleton
   */
  Input: ({ className, ...props }: Omit<UnifiedSkeletonProps, 'variant'>) => (
    <UnifiedSkeleton
      variant="default"
      className={cn('w-full', INPUT_HEIGHT_CLASS, INPUT_RADIUS_CLASS, className)}
      {...props}
    />
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
