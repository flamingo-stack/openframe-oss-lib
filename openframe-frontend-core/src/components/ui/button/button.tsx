'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import Link from '../../../embed-shims/next-link';
import { cn } from '../../../utils/cn';
import { loadingItemProps } from '../loading-scope';
import {
  BUTTON_SIZE_CLASS,
  buttonSurfaceClasses,
  outlineBorderClasses,
  splitDividerColorClasses,
  splitGlyphSizeBySize,
} from './button-styles';

// Default layout: centered single content area, padding/gap on the button itself.
/** The `icon-sm` button's size (its `h-8 w-8`), for a layout that must leave room for one. */
export const BUTTON_ICON_SM_SIZE = '2rem';

const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-[var(--spacing-system-xsf)]',
    'whitespace-nowrap rounded-md',
    'transition-colors duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus',
    'disabled:pointer-events-none',
    '[&_svg]:pointer-events-none [&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        accent: buttonSurfaceClasses.accent,
        outline: cn(buttonSurfaceClasses.outline, outlineBorderClasses),
        transparent: buttonSurfaceClasses.transparent,
        destructive: buttonSurfaceClasses.destructive,
        warning: buttonSurfaceClasses.warning,
        inverted: buttonSurfaceClasses.inverted,
        glyph: buttonSurfaceClasses.glyph,
        overlay: buttonSurfaceClasses.overlay,
        link: buttonSurfaceClasses.link,
      },
      size: BUTTON_SIZE_CLASS,
      // Label typography axis (Figma 133-740). `bold` is the classic h3-bold
      // label; `regular` swaps the DEFAULT size's label to the h4 step
      // (DM Sans 500, neutral tracking) — added for navigation buttons.
      // `small` keeps its mono-uppercase h5 label on both fonts per the spec.
      font: {
        bold: '',
        regular: '',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
      noPaddingX: {
        true: 'px-0',
        false: '',
      },
      // Two buttons drawn as ONE surface with a seam between them (a main action
      // and a chevron that opens its alternatives: `DropdownButton` with an
      // `action`). `start` is the leading half, `end` the trailing one: each
      // gives up the corners and the border on its inner edge.
      attach: {
        none: '',
        start: 'rounded-r-none',
        end: 'rounded-l-none border-l-0',
      },
    },
    compoundVariants: [
      // The trailing half as an icon button is the design's 40px chevron cell, at every breakpoint.
      { attach: 'end', size: 'icon', class: 'w-10 px-0 md:w-10' },
      { size: 'small', class: '[&_svg]:h-4 [&_svg]:w-4' },
      // Comes after the size classes, so cn()'s tailwind-merge resolves the
      // ods-typography group in favour of text-h4.
      { size: 'default', font: 'regular', class: 'text-h4' },
    ],
    defaultVariants: {
      variant: 'accent',
      size: 'default',
      font: 'bold',
      fullWidth: false,
      noPaddingX: false,
      attach: 'none',
    },
  },
);

// Split layout (used when `splitIcon` is provided): outer button has no padding;
// inner slots own padding/gap so the divider can span full button height.
const splitShellVariants = cva(
  [
    'group relative inline-flex items-stretch overflow-hidden whitespace-nowrap rounded-md',
    'transition-colors duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus',
    'disabled:pointer-events-none',
  ],
  {
    variants: {
      variant: {
        accent: buttonSurfaceClasses.accent,
        outline: cn(buttonSurfaceClasses.outline, outlineBorderClasses),
        transparent: buttonSurfaceClasses.transparent,
        destructive: buttonSurfaceClasses.destructive,
        warning: buttonSurfaceClasses.warning,
      },
      size: {
        default: 'h-12',
        small: 'h-6 text-h5 md:h-8',
      },
      // Same label-typography axis as the normal layout — `regular` swaps the
      // default size's h3-bold label for the h4 (DM Sans 500) step.
      font: { bold: '', regular: '' },
      fullWidth: { true: 'w-full', false: '' },
    },
    compoundVariants: [
      { size: 'default', font: 'bold', class: 'text-h3' },
      { size: 'default', font: 'regular', class: 'text-h4' },
    ],
    defaultVariants: { variant: 'accent', size: 'default', font: 'bold', fullWidth: false },
  },
);

const splitSlotVariants = cva(
  // Glyph size lives per-size, not in the base: cva concatenates base + variant
  // without tailwind-merge, so a base `[&_svg]:h-5` and a variant `[&_svg]:h-4`
  // would both ship and the winner would come down to stylesheet order.
  ['inline-flex items-center justify-center', '[&_svg]:shrink-0'],
  {
    variants: {
      slot: {
        main: 'gap-[var(--spacing-system-xsf)]',
        icon: 'border-l',
      },
      size: splitGlyphSizeBySize,
      variant: { accent: '', outline: '', transparent: '', destructive: '', warning: '' },
      fullWidth: { true: '', false: '' },
    },
    compoundVariants: [
      { slot: 'main', size: 'default', class: 'px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)]' },
      { slot: 'main', size: 'small', class: 'px-[var(--spacing-system-xs)]' },
      // `fullWidth` stretches the SHELL, not its children, so without this the main
      // half stays content-sized and the icon half floats mid-button with dead space
      // after it instead of sitting flush against the trailing edge. Keyed on
      // `fullWidth` to match `SplitButton`, which grows its main half on exactly the
      // same condition (`grow={fullWidth}`) — the two split layouts render side by
      // side in the same rows and must not disagree. Callers that stretch the shell
      // some other way (a `flex-1` className, a grid cell) keep the old behaviour.
      { slot: 'main', fullWidth: true, class: 'flex-1' },
      { slot: 'icon', size: 'default', class: 'w-10' },
      { slot: 'icon', size: 'small', class: 'w-6 md:w-8' },
      {
        slot: 'icon',
        variant: 'accent',
        class: cn(
          splitDividerColorClasses.accent,
          'group-disabled:border-ods-disabled group-aria-disabled:border-ods-disabled',
        ),
      },
      { slot: 'icon', variant: 'outline', class: splitDividerColorClasses.outline },
      { slot: 'icon', variant: 'transparent', class: splitDividerColorClasses.transparent },
      {
        slot: 'icon',
        variant: 'destructive',
        class: cn(
          splitDividerColorClasses.destructive,
          'group-disabled:border-ods-disabled group-aria-disabled:border-ods-disabled',
        ),
      },
      {
        slot: 'icon',
        variant: 'warning',
        class: cn(
          splitDividerColorClasses.warning,
          'group-disabled:border-ods-disabled group-aria-disabled:border-ods-disabled',
        ),
      },
    ],
    defaultVariants: { slot: 'main', size: 'default', variant: 'accent', fullWidth: false },
  },
);

/** @deprecated Use `size="small"` instead. Temporary alias kept for backward compatibility; will be removed in the future. */
type DeprecatedButtonSize = 'small-legacy';

type ButtonSize =
  Exclude<VariantProps<typeof buttonVariants>['size'], 'small-legacy' | null | undefined> | DeprecatedButtonSize;

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, Omit<VariantProps<typeof buttonVariants>, 'size'> {
  asChild?: boolean;
  href?: string;
  openInNewTab?: boolean;
  prefetch?: boolean;
  /**
   * Pre-resolved anchor bundle (from `useNavLink({ href, targetPlatform })`).
   * When set, renders the Button as `<Link>` with `href` / `target` / `rel`
   * / `onClick` spread from this object. Lets callers thread the unified
   * nav decision directly without `<Button asChild><a {...linkProps}/>`
   * gymnastics. Wins over the separate `href` / `openInNewTab` props.
   */
  /**
   * Render a plain `<a href download>` instead of a Next `<Link>`.
   * A download is a RESOURCE fetch, not a route change: `<Link>` would try to
   * prefetch/route it. Only meaningful together with `href`.
   */
  download?: boolean | string;
  linkProps?: {
    href: string;
    target?: '_blank';
    /** `noopener` alone keeps the Referer for a new-tab link to one of our own
     *  platforms (cross-domain analytics attribution); `noreferrer` is for
     *  third-party destinations. */
    rel?: 'noopener' | 'noopener noreferrer';
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  } | null;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /**
   * Renders a vertical divider and trailing icon area inside the button.
   * The whole button stays a single click target — the icon is decorative
   * (`aria-hidden`). For two independent click targets, use `<SplitButton>`.
   * Only honored when `size` is `"default"` or `"small"`.
   */
  splitIcon?: React.ReactNode;
  loading?: boolean;
  size?: ButtonSize;
}

const Spinner = () => (
  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function ButtonImpl(
  {
    className,
    variant,
    size,
    font,
    fullWidth,
    noPaddingX,
    attach,
    asChild,
    href,
    openInNewTab,
    prefetch,
    linkProps,
    download,
    leftIcon,
    rightIcon,
    splitIcon,
    loading,
    children,
    disabled,
    onClick,
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading;

  // splitIcon is only supported for default/small sizes. With other sizes
  // (icon, small-legacy) we silently fall back to the normal layout.
  const useSplitLayout = !!splitIcon && (size === 'default' || size === 'small' || size === undefined);

  if (useSplitLayout) {
    const safeSize = size ?? 'default';
    const safeVariant = (variant ?? 'accent') as 'accent' | 'outline' | 'transparent' | 'destructive' | 'warning';
    const shellClasses = cn(splitShellVariants({ variant: safeVariant, size: safeSize, font, fullWidth }), className);
    const mainSlotClass = splitSlotVariants({ slot: 'main', size: safeSize, variant: safeVariant, fullWidth });
    const iconSlotClass = splitSlotVariants({ slot: 'icon', size: safeSize, variant: safeVariant });

    const splitContent = (
      <>
        <span className={cn('contents', loading && 'invisible')}>
          <span className={mainSlotClass}>
            {leftIcon && <span className="inline-flex items-center">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="inline-flex items-center">{rightIcon}</span>}
          </span>
          <span aria-hidden="true" className={iconSlotClass}>
            {splitIcon}
          </span>
        </span>
        {loading && (
          // Carries the glyph scale itself: this overlay is a SIBLING of the slots, so
          // it inherits neither their `[&_svg]` sizing nor a shell base rule (the shell
          // deliberately has none — see `splitSlotVariants`). Without it the spinner
          // renders unconstrained and fills the button. Reads the same per-size ramp the
          // slots do, so it matches the glyphs it covers at both breakpoints.
          <span
            className={cn(
              'absolute inset-0 inline-flex items-center justify-center text-ods-text-primary',
              splitGlyphSizeBySize[safeSize],
            )}
          >
            <Spinner />
          </span>
        )}
      </>
    );

    // A download is a resource fetch, not a route change: same `Link` as every
    // other anchor branch (so a host that registered `next/link` keeps ONE
    // anchor implementation), with prefetch off — there is no route to warm,
    // and prefetching would fetch the file itself. Checked BEFORE the
    // linkProps/href resolution.
    if (download && href) {
      return (
        <Link
          href={href}
          download={download}
          prefetch={false}
          className={cn(shellClasses, isDisabled && 'pointer-events-none')}
          // The click still reaches the caller (a download is what analytics counts).
          onClick={onClick as unknown as React.MouseEventHandler<HTMLAnchorElement> | undefined}
          aria-label={props['aria-label']}
          {...loadingItemProps(props)}
        >
          {splitContent}
        </Link>
      );
    }

    // `linkProps` (the pre-resolved bundle from `useNavLink({ href, targetPlatform })`)
    // wins over the legacy `href` + `openInNewTab` props so callers can thread
    // the unified nav decision directly. Either path produces the same `<Link>`.
    const splitAnchor =
      linkProps ??
      (href
        ? {
            href,
            target: openInNewTab ? ('_blank' as const) : undefined,
            rel: openInNewTab ? ('noopener noreferrer' as const) : undefined,
            onClick: onClick as unknown as React.MouseEventHandler<HTMLAnchorElement> | undefined,
          }
        : null);
    if (splitAnchor) {
      return (
        <Link
          href={splitAnchor.href}
          prefetch={prefetch}
          target={splitAnchor.target}
          rel={splitAnchor.rel}
          // The Link branches don't spread {...props} (button attrs don't
          // belong on an anchor), but the accessible name MUST survive —
          // icon-only link buttons have no text content.
          aria-label={props['aria-label']}
          aria-disabled={isDisabled || undefined}
          tabIndex={isDisabled ? -1 : undefined}
          className={cn(shellClasses, isDisabled && 'pointer-events-none')}
          onClick={splitAnchor.onClick}
          // A list's markers (`data-loading-item`) survive on an anchor too.
          {...loadingItemProps(props)}
        >
          {splitContent}
        </Link>
      );
    }

    return (
      <button ref={ref} className={shellClasses} disabled={isDisabled} onClick={onClick} {...props}>
        {splitContent}
      </button>
    );
  }

  const classes = cn(buttonVariants({ variant, size, font, fullWidth, noPaddingX, attach }), className);

  // asChild: consumer fully controls the rendered element; we just stamp our classes.
  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  // Real content stays in layout (preserving width) but goes invisible while loading.
  // The spinner is absolutely positioned so it never shifts the button's size.
  const content = (
    <>
      <span className={cn('contents', loading && 'invisible')}>
        {leftIcon && <span className="inline-flex items-center">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="inline-flex items-center">{rightIcon}</span>}
      </span>
      {loading && (
        <span className="absolute inset-0 inline-flex items-center justify-center text-ods-text-primary">
          <Spinner />
        </span>
      )}
    </>
  );

  // Same download short-circuit as the splitIcon branch.
  if (download && href) {
    return (
      <Link
        href={href}
        download={download}
        prefetch={false}
        className={cn(classes, isDisabled && 'pointer-events-none')}
        onClick={onClick as unknown as React.MouseEventHandler<HTMLAnchorElement> | undefined}
        aria-label={props['aria-label']}
      >
        {content}
      </Link>
    );
  }

  // Same `linkProps`-wins-over-href resolution as the splitIcon branch.
  const anchor =
    linkProps ??
    (href
      ? {
          href,
          target: openInNewTab ? ('_blank' as const) : undefined,
          rel: openInNewTab ? ('noopener noreferrer' as const) : undefined,
          onClick: onClick as unknown as React.MouseEventHandler<HTMLAnchorElement> | undefined,
        }
      : null);
  if (anchor) {
    return (
      <Link
        href={anchor.href}
        prefetch={prefetch}
        target={anchor.target}
        rel={anchor.rel}
        // See the splitAnchor branch — keep the accessible name on the
        // anchor render (icon-only link buttons have no text content).
        aria-label={props['aria-label']}
        aria-disabled={isDisabled || undefined}
        tabIndex={isDisabled ? -1 : undefined}
        className={cn(classes, isDisabled && 'pointer-events-none')}
        onClick={anchor.onClick}
      >
        {content}
      </Link>
    );
  }

  return (
    <button ref={ref} className={classes} disabled={isDisabled} onClick={onClick} {...props}>
      {content}
    </button>
  );
});
Button.displayName = 'Button';

export { Button, buttonVariants, type ButtonProps };
