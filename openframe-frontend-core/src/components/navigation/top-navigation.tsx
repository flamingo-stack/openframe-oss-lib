'use client';

import React from 'react';
import { cn } from '../../utils/cn';

export type TopNavigationCenterBreakpoint = 'md' | 'lg';

// Literal class maps — Tailwind's scanner needs the full class strings.
const CENTER_VISIBILITY: Record<TopNavigationCenterBreakpoint, string> = {
  md: 'hidden md:flex',
  lg: 'hidden lg:flex',
};
const LOGO_GROW: Record<TopNavigationCenterBreakpoint, string> = {
  md: 'flex-1 md:flex-none',
  lg: 'flex-1 lg:flex-none',
};

export interface TopNavigationProps extends React.HTMLAttributes<HTMLElement> {
  /** Leading cells (burger toggle, admin-sidebar toggle). Rendered raw, first
   *  in the row — cells carry their own trailing divider
   *  (`border-r border-ods-border`), matching the ODS spec where dividers
   *  belong to the cells, not the bar. */
  leading?: React.ReactNode;
  /** Logo zone content. Grows (`flex-1`) below `centerBreakpoint`, shrinks to
   *  content above it. Wrap in a `<Link>` on the consumer side if clickable. */
  logo?: React.ReactNode;
  /** Extra classes for the logo zone. Defaults follow the ODS spec paddings:
   *  `p-m` on mobile, `pl-l` (24px) from md, `pl-xxl` (80px) from lg — the
   *  desktop inset mirrors the leading menu-cell width so centered nav links
   *  sit visually centered (Figma 2797-6808 / 2805-6194). */
  logoClassName?: string;
  /** Center zone (marketing nav links, console global search). Hidden below
   *  `centerBreakpoint`; above it, it is the `flex-1` region that pushes the
   *  CTA and side actions to the right edge. Rendered even when empty so the
   *  bar always has its spacer. */
  center?: React.ReactNode;
  centerClassName?: string;
  /** Breakpoint at which the center zone appears (and the logo zone stops
   *  growing). ODS spec default is `lg` (nav links are desktop-only);
   *  the console header uses `md` for its global search. */
  centerBreakpoint?: TopNavigationCenterBreakpoint;
  /** CTA zone — right-aligned, padded, no dividers (per ODS spec). */
  cta?: React.ReactNode;
  ctaClassName?: string;
  /** Trailing action cells (time tracker, notifications, avatar, Mingo).
   *  Rendered raw — each cell carries its own leading divider
   *  (`border-l border-ods-border`). */
  sideActions?: React.ReactNode;
  /** Opaque ODS background class. Defaults to `bg-ods-card`. Keep it opaque —
   *  translucent backgrounds under a sticky bar need a deliberate
   *  backdrop-blur treatment (see the note in `header.tsx`). */
  backgroundClassName?: string;
  /** Top border on mobile (the ODS spec bar shows it below md). Default true. */
  mobileTopBorder?: boolean;
}

const hasContent = (node: React.ReactNode): boolean => node !== null && node !== undefined && node !== false;

/**
 * Unified ODS top-navigation bar (Figma `[UPD] top-navigation`, node
 * 2797-5978): the single 48px/56px (mobile / md+) cell-based header shell
 * shared by the console `AppHeader` and the marketing `Header` across all
 * platforms.
 *
 * The shell owns the bar geometry only — height, borders, background, and the
 * zone layout `[leading][logo][center][cta][sideActions]`. What goes inside
 * the zones (and each cell's divider) is the consumer's job, so platforms can
 * differ in background and in which elements they mount without forking the
 * bar itself.
 */
export function TopNavigation({
  leading,
  logo,
  logoClassName,
  center,
  centerClassName,
  centerBreakpoint = 'lg',
  cta,
  ctaClassName,
  sideActions,
  backgroundClassName,
  mobileTopBorder = true,
  className,
  children,
  ...props
}: TopNavigationProps) {
  return (
    <header
      className={cn(
        'flex h-12 w-full items-center border-b border-ods-border md:h-14',
        mobileTopBorder && 'border-t md:border-t-0',
        backgroundClassName ?? 'bg-ods-card',
        className,
      )}
      {...props}
    >
      {leading}
      {hasContent(logo) && (
        <div
          className={cn(
            'flex h-full min-w-0 items-center',
            LOGO_GROW[centerBreakpoint],
            'p-[var(--spacing-system-m)] md:py-0 md:pr-0 md:pl-[var(--spacing-system-l)] lg:pl-[var(--spacing-system-xxl)]',
            logoClassName,
          )}
        >
          {logo}
        </div>
      )}
      <div
        className={cn(
          CENTER_VISIBILITY[centerBreakpoint],
          'h-full min-w-0 flex-1 items-center justify-center',
          centerClassName,
        )}
      >
        {center}
      </div>
      {hasContent(cta) && (
        <div className={cn('flex h-full shrink-0 items-center px-[var(--spacing-system-m)]', ctaClassName)}>{cta}</div>
      )}
      {sideActions}
      {children}
    </header>
  );
}

export default TopNavigation;
