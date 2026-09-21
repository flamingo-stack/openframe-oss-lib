'use client';

import type React from 'react';
import { useState, useRef, useCallback } from 'react';
import { useIsomorphicLayoutEffect } from '../../hooks/ui/use-isomorphic-layout-effect';

// =============================================================================
// Types
// =============================================================================

export interface HoverDropdownItem {
  label: string;
  icon?: React.ReactNode;
  href?: string;
  /**
   * Target platform for the row's link — threaded through to the caller's
   * `renderAnchor` slot, which decides how to route (same tab vs new tab,
   * embed-aware open, etc.). Plain UI dropdown — no internal click rule.
   */
  targetPlatform?: string | null;
  /**
   * In-app doc-tree path for `markdown` / `data_room_doc` refs. Threaded
   * through to the caller's `renderAnchor` so chat consumers can wire it
   * into `handleChatNavClick` and trigger an in-page doc-tree swap
   * (parity with source chips and inline cards).
   */
  path?: string | null;
  /**
   * @deprecated Pass `targetPlatform` to the consumer's `renderAnchor` and
   * let it decide. Kept on the item shape for caller-side decisions but
   * unused by this component.
   */
  alwaysNewTab?: boolean;
  onClick?: () => void;
  /** Optional secondary action rendered as a small icon-button at the
   *  right edge of the row. Independent of the row's primary click target
   *  — clicking the secondary button does NOT navigate. */
  secondaryAction?: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
  };
}

export interface HoverDropdownRenderAnchorArgs {
  href: string;
  targetPlatform?: string | null;
  /** In-app doc-tree path — chat consumers forward to `handleChatNavClick`
   *  for doc-tree swap parity with chips + inline cards. */
  path?: string | null;
  alwaysNewTab?: boolean;
  className: string;
  children: React.ReactNode;
}

interface HoverDropdownProps {
  /** The trigger element — dropdown appears on hover */
  children: React.ReactNode;
  /** Items to show in the dropdown */
  items: HoverDropdownItem[];
  /** Dropdown position relative to trigger (default: 'top') */
  side?: 'top' | 'bottom';
  /** Delay in ms before hiding on mouse leave (default: 200) */
  hideDelay?: number;
  /** Additional className for the dropdown container */
  className?: string;
  /**
   * Optional anchor renderer for rows that have an `href`. Chat consumers
   * supply a `<NavLinkAnchorViaRuntime>`-backed renderer so clicks route
   * through the chat runtime; non-chat consumers can skip this and rely
   * on the default plain `<a>`.
   */
  renderAnchor?: (args: HoverDropdownRenderAnchorArgs) => React.ReactNode;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Generic hover dropdown — shows a list of clickable items on hover.
 *
 * Uses fixed positioning with getBoundingClientRect for proper placement
 * inside containers with overflow hidden (e.g., Sheet, modals).
 *
 * Usage:
 *   <HoverDropdown items={[{ label: 'Blog Post', href: '/blog/1' }]}>
 *     <span>Blog Posts (5)</span>
 *   </HoverDropdown>
 */
function DefaultAnchor({ href, className, children }: HoverDropdownRenderAnchorArgs) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export function HoverDropdown({
  children,
  items,
  side = 'top',
  hideDelay = 200,
  className,
  renderAnchor,
}: HoverDropdownProps) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Viewport-fit placement is a DOM MEASUREMENT — the panel's own rendered
  // width/height plus the trigger's live rect — so it is written to the node
  // from a layout effect rather than from inside a callback ref. Deliberately
  // dependency-less, which reproduces the callback ref's cadence exactly: the
  // ref was an inline arrow, so React tore it down and re-attached it on EVERY
  // commit, re-placing the panel each time. It still runs before paint, so the
  // panel's first frame is already at its final coordinates and never jumps.
  useIsomorphicLayoutEffect(() => {
    const el = panelRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    const rect = container.getBoundingClientRect();
    const elHeight = el.offsetHeight;
    const elWidth = el.offsetWidth;

    // Try to place to the right of the trigger first
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;
    const fitsRight = spaceRight >= elWidth + 8;
    const fitsLeft = spaceLeft >= elWidth + 8;

    if (fitsRight || (!fitsLeft && spaceRight >= spaceLeft)) {
      // Place to the right
      el.style.left = `${rect.right + 4}px`;
      el.style.top = `${Math.min(Math.max(rect.top, 8), window.innerHeight - elHeight - 8)}px`;
    } else if (fitsLeft) {
      // Place to the left
      el.style.left = `${rect.left - elWidth - 4}px`;
      el.style.top = `${Math.min(Math.max(rect.top, 8), window.innerHeight - elHeight - 8)}px`;
    } else {
      // Fallback: place above or below
      const left = Math.min(Math.max(rect.left, 8), window.innerWidth - elWidth - 8);
      el.style.left = `${left}px`;
      if (side === 'top' || window.innerHeight - rect.bottom < elHeight + 8) {
        el.style.top = `${Math.max(rect.top - elHeight - 4, 8)}px`;
      } else {
        el.style.top = `${rect.bottom + 4}px`;
      }
    }
  });

  const show = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    timeoutRef.current = setTimeout(() => setOpen(false), hideDelay);
  }, [hideDelay]);

  // Click handler — touch / mobile (no hover) + desktop users who
  // expect clicking a chip to open a menu. Toggles the dropdown state
  // so a second click closes it. `stopPropagation` prevents the click
  // from bubbling to ancestor handlers (the chip's parent message
  // bubble shouldn't react to chip clicks).
  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    clearTimeout(timeoutRef.current);
    setOpen(prev => !prev);
  }, []);

  // Every hook is above this line: an `items` list that goes from empty to
  // populated must not change how many hooks this component renders.
  if (items.length === 0) return <>{children}</>;

  const renderAnchorFn = renderAnchor ?? DefaultAnchor;

  return (
    <div ref={containerRef} className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onClick={toggle}>
      {children}
      {open && (
        <div
          className={`fixed z-[9999] max-h-[420px] min-w-[220px] max-w-[340px] overflow-y-auto rounded-lg border border-ods-border bg-ods-card p-1 shadow-xl ${className || ''}`}
          // `left`/`top` are intentionally absent here — the layout effect above
          // owns them, because both values are live DOM measurements.
          ref={panelRef}
        >
          {items.map((item, i) => {
            const content = (
              <>
                {item.icon && <span className="flex-shrink-0 [&_svg]:size-3.5">{item.icon}</span>}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </>
            );

            // Each row is a flex container: primary action (link or button)
            // occupies the left expanding region; the optional secondary
            // action ("Ask") sits at the right as a sibling icon-button so
            // its click is independent of the primary navigation.
            const rowClass =
              'group flex w-full items-center gap-1.5 pl-2 pr-1 py-1.5 rounded text-h6 text-ods-text-secondary hover:bg-ods-accent/10 transition-colors text-left';
            const primaryClass =
              'flex flex-1 items-center gap-1.5 min-w-0 hover:text-ods-accent cursor-pointer no-underline';

            // Bound before the JSX: the `onClick` handler fires long after this
            // render, so the `item.secondaryAction` narrowing does not reach
            // inside it — the local does.
            const secondaryAction = item.secondaryAction;
            const secondary = secondaryAction ? (
              <button
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  secondaryAction.onClick();
                }}
                aria-label={secondaryAction.label}
                title={secondaryAction.label}
                className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-ods-text-secondary opacity-60 transition-opacity hover:bg-ods-accent/15 hover:text-ods-text-primary hover:opacity-100 [&_svg]:size-3"
              >
                {secondaryAction.icon}
              </button>
            ) : null;

            if (item.href) {
              // Caller supplies the anchor renderer (defaults to plain <a>).
              // Chat consumers wire `NavLinkAnchorViaRuntime` here so clicks
              // route through the chat runtime.
              return (
                <div key={i} className={rowClass}>
                  {renderAnchorFn({
                    href: item.href,
                    targetPlatform: item.targetPlatform,
                    path: item.path,
                    alwaysNewTab: item.alwaysNewTab,
                    className: primaryClass,
                    children: content,
                  })}
                  {secondary}
                </div>
              );
            }

            // Item has no primary action — render the label as a
            // non-interactive span. The secondary Ask button remains
            // active, so the row is still useful for rows that have no
            // public viewer URL but DO have a working Ask drill-in.
            if (!item.onClick) {
              return (
                <div key={i} className={rowClass}>
                  <span className={`${primaryClass} cursor-default hover:!text-ods-text-secondary`}>{content}</span>
                  {secondary}
                </div>
              );
            }

            return (
              <div key={i} className={rowClass}>
                <button onClick={item.onClick} className={primaryClass}>
                  {content}
                </button>
                {secondary}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
