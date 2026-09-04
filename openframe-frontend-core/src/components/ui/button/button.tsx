'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import Link from '../../../embed-shims/next-link';
import { cn } from '../../../utils/cn';
import {
  buttonSurfaceClasses,
  outlineBorderClasses,
  splitDividerColorClasses,
  splitGlyphSizeBySize,
} from './button-styles';

// Default layout: centered single content area, padding/gap on the button itself.
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
        glyph: buttonSurfaceClasses.glyph,
        overlay: buttonSurfaceClasses.overlay,
      },
      size: {
        default: 'h-11 px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)] text-h3 md:h-12',
        small: 'h-6 p-[var(--spacing-system-xs)] text-h5 md:h-8',
        'small-legacy': 'h-10 px-[var(--spacing-system-m)] py-[var(--spacing-system-xs)] text-[14px] font-bold', // Temporary alias for "small" — deprecated; grep size="small-legacy" (lib + hub) and migrate the remaining consumers before removal
        // 24px pill for slim strips (announcement/promo bars, inline banner
        // actions — Primer banner / Polaris banner / Vercel-bar convention).
        // The label matches the strip's MESSAGE type ramp exactly (DM Sans
        // regular, 13px -> md:14px, snug leading — the announcement bar's
        // subtitle styling): in-strip CTAs must never read louder than the
        // message beside them, so this deliberately uses neither the
        // mono-uppercase control style of "small" nor a heavier weight.
        // Pinned h-6 across breakpoints (24px = the WCAG 2.5.8 target-size
        // floor) with horizontal-dominant padding and a 14px glyph.
        compact: 'h-6 px-[var(--spacing-system-sf)] py-0 font-normal text-h6 [&_svg]:h-3.5 [&_svg]:w-3.5',
        icon: 'h-11 w-11 p-[var(--spacing-system-sf)] md:h-12 md:w-12 [&_svg]:h-4 [&_svg]:w-4 md:[&_svg]:h-6 md:[&_svg]:w-6',
        // Quiet 32px icon target with a 16px glyph, fixed across breakpoints
        // (Carbon ghost sm / Primer medium / shadcn icon-sm all pin 32px;
        // ≥ the 24px WCAG 2.5.8 target floor). For icon actions that read as
        // metadata rather than CTAs — author-page social rows, share rows.
        // Pair with variant="transparent" for the ghost treatment.
        'icon-sm': 'h-8 w-8 p-[var(--spacing-system-xxs)] [&_svg]:h-4 [&_svg]:w-4',
        // 20px inline glyph for affordances that sit INSIDE a line of text —
        // an info hint beside a badge, a copy glyph after an id. `icon-sm`'s
        // 32px target is correct for a metadata row but visually swamps a
        // 10px badge or a 14px label, so hosts were reaching for className
        // overrides to shrink it. Below the WCAG 2.5.8 target floor on purpose:
        // this is only for glyphs whose information is ALSO available another
        // way (tooltip content mirrored into an aria-describedby node), never
        // for a sole means of performing an action.
        'icon-inline': 'h-5 min-h-0 w-5 min-w-0 shrink-0 p-0 [&_svg]:h-3.5 [&_svg]:w-3.5',
        // Bare 56px media glyph (play / unmute over video). A size variant so
        // hosts stop re-implementing a <button> to escape the 20px svg cap.
        'icon-glyph': 'h-14 w-14 p-0 [&_svg]:h-14 [&_svg]:w-14',
      },
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
    },
    compoundVariants: [
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
    rel?: 'noopener noreferrer';
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

    // A download is a resource fetch, not a route change — plain anchor, no
    // prefetch, no router. Checked BEFORE the linkProps/href resolution.
    if (download && href) {
      return (
        <a
          href={href}
          download={download}
          className={cn(shellClasses, isDisabled && 'pointer-events-none')}
          aria-label={props['aria-label']}
        >
          {splitContent}
        </a>
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

  const classes = cn(buttonVariants({ variant, size, font, fullWidth, noPaddingX }), className);

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
      <a
        href={href}
        download={download}
        className={cn(classes, isDisabled && 'pointer-events-none')}
        aria-label={props['aria-label']}
      >
        {content}
      </a>
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
