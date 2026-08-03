'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from '../../embed-shims/next-link';
import { HeaderConfig, NavigationItem } from '../../types/navigation';
import { cn } from '../../utils';
import { Menu01Icon, XmarkIcon } from '../icons-v2-generated';
import { Button } from '../ui/button';
import { HeaderButton } from './header-button';
import { MingoAiButton } from './mingo-ai-button';
import { MOBILE_NAV_PANEL_ID } from './mobile-nav-panel';
import { TicketAlertsButton } from './ticket-alerts-button';
import { TopNavigation } from './top-navigation';

export interface HeaderProps {
  config: HeaderConfig;
  platform?: string;
}

// Re-export from types for convenience
export type { HeaderConfig } from '../../types/navigation';

// Top-level nav-link typography (Figma 2936-6815): the compact h6 step
// (DM Sans 500, 14/20) with 24px icons. Overrides the `font="regular"` h4
// label and the Button base's 20px svg cap via cn()'s tailwind-merge.
const NAV_ITEM_CLASSES = 'text-h6 [&_svg]:h-6 [&_svg]:w-6';

export function Header({ config, platform }: HeaderProps) {
  const [show, setShow] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Handle click outside and escape key for custom dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target) return;

      // Check if click is outside all dropdowns
      const isOutsideAllDropdowns = Object.keys(openDropdowns).every(id => {
        const dropdown = dropdownRefs.current[id];
        const trigger = triggerRefs.current[id];

        if (!dropdown || !trigger) return true;

        return !dropdown.contains(target) && !trigger.contains(target);
      });

      if (isOutsideAllDropdowns) {
        setOpenDropdowns({});
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenDropdowns({});
      }
    };

    // Only add listeners if any dropdown is open
    const hasOpenDropdowns = Object.values(openDropdowns).some(Boolean);
    if (hasOpenDropdowns) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [openDropdowns]);

  // Force close all dropdowns and cleanup on unmount
  useEffect(() => {
    return () => {
      // Close all dropdowns before unmounting to prevent focus errors
      setOpenDropdowns({});
      // Clear any stored refs
      dropdownRefs.current = {};
      triggerRefs.current = {};
    };
  }, []);

  useEffect(() => {
    // Only add scroll listener if autoHide is enabled
    if (!config.autoHide) {
      setShow(true); // Always show header when autoHide is disabled
      return;
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      setLastScrollY(prevScrollY => {
        // Determine if we should show or hide the header
        const shouldHide = currentScrollY > prevScrollY && currentScrollY > 50;
        const shouldShow = currentScrollY < prevScrollY || currentScrollY <= 10;

        if (shouldHide) {
          setShow(false);
        } else if (shouldShow) {
          setShow(true);
        }

        return currentScrollY;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [config.autoHide]);

  const renderNavigationItem = (item: NavigationItem) => {
    // If custom element provided, use it
    if (item.element) {
      return <React.Fragment key={item.id}>{item.element}</React.Fragment>;
    }

    // If it has children, render as custom dropdown
    if (item.children && item.children.length > 0) {
      const isOpen = openDropdowns[item.id] || false;

      return (
        <div key={item.id} className="relative">
          <Button
            ref={el => {
              triggerRefs.current[item.id] = el;
            }}
            variant="transparent"
            leftIcon={item.icon}
            rightIcon={item.badge}
            onClick={() => {
              // Single-open: opening a dropdown closes any other open one —
              // only one nav dropdown may be expanded at a time.
              setOpenDropdowns(prev => ({
                [item.id]: !prev[item.id],
              }));
            }}
            size="default"
            font="regular"
            className={cn(
              // Top-level nav links (Figma 2936-6815): compact h6 label
              // (DM Sans 500, 14/20) with 24px icons — overrides the
              // font="regular" h4 step and the button's 20px svg cap.
              NAV_ITEM_CLASSES,
              item.isActive && 'bg-ods-bg-hover', // Active items get subtle gray background
              isOpen && 'bg-ods-bg-hover', // Open dropdowns get gray background
              item.className,
            )}
          >
            {item.label}
          </Button>

          {/* Always render dropdown in DOM so crawlers see child <a> links;
              toggle visibility via CSS + `inert`.

              Why `inert` (not `aria-hidden`):
                - `aria-hidden=true` HIDES from screen readers but DOES NOT
                  remove focusable descendants from the tab order. If a child
                  retains focus (e.g., the dropdown closes while a child was
                  hovered/focused), the browser correctly flags "Blocked
                  aria-hidden on an element because its descendant retained
                  focus" — a real WAI-ARIA violation.
                - `inert` is the HTML-standard attribute that does BOTH:
                  removes from a11y tree + blocks focus + prevents click +
                  removes from tab order. Native React 19 support. */}
          <div
            ref={el => {
              dropdownRefs.current[item.id] = el;
            }}
            inert={!isOpen}
            className={cn(
              'absolute top-full left-0 mt-1',
              item.dropdownClassName ? '' : 'bg-ods-card border border-ods-border',
              'rounded-lg shadow-xl z-[9999]',
              item.id === 'community' ? 'min-w-[240px]' : 'min-w-[220px]',
              'transition-opacity duration-150',
              isOpen ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none',
              item.dropdownClassName || '',
            )}
          >
            <div className="p-2">
              {item.children.map((child, index) => (
                <Button
                  key={child.id}
                  variant="transparent"
                  size="small-legacy"
                  href={child.href} // Use href for navigation
                  leftIcon={child.icon}
                  rightIcon={child.badge}
                  onClick={() => {
                    // Always close dropdown when any item is clicked
                    setOpenDropdowns(prev => ({ ...prev, [item.id]: false }));
                    // If there's a custom onClick, call it too
                    if (child.onClick) {
                      child.onClick();
                    }
                  }}
                  className={cn(
                    'flex justify-start w-full',
                    // Same caption step as the top-level nav links (designer:
                    // dropdowns follow the h6 caption size/weight too). The
                    // explicit font-medium beats small-legacy's font-bold via
                    // tailwind-merge instead of stylesheet order.
                    'text-h6 font-medium',
                    index < (item.children?.length ?? 0) - 1 && 'mb-1',
                    'text-ods-text-primary', // All dropdown items use primary text color
                    child.isActive && 'bg-ods-bg-hover', // Active dropdown items get gray background
                  )}
                  {...(child.isExternal && { isExternal: true })}
                >
                  {child.label}
                </Button>
              ))}
            </div>
            {item.dropdownContent && (
              <>
                {item.showDropdownDivider !== false && <div className="h-px my-2 mx-2 bg-ods-border" />}
                <div className="px-2 pb-2">{item.dropdownContent}</div>
              </>
            )}
          </div>
        </div>
      );
    }

    // Regular navigation item
    if (item.href || item.onClick) {
      return (
        <Button
          key={item.id}
          variant="transparent"
          href={item.href} // Use href for navigation
          onClick={item.onClick} // Only for non-navigation actions
          leftIcon={item.icon}
          rightIcon={item.badge}
          size="default"
          font="regular"
          className={cn(
            NAV_ITEM_CLASSES,
            'hover:bg-ods-bg-hover focus:bg-ods-bg-hover',
            'whitespace-nowrap',
            'text-ods-text-primary', // All items use primary text color
            item.isActive && 'bg-ods-bg-hover', // Active items get subtle gray background
            item.className,
          )}
          {...(item.isExternal && { isExternal: true })}
        >
          {item.label}
        </Button>
      );
    }

    // Button with onClick
    return (
      <Button
        key={item.id}
        variant="transparent"
        onClick={item.onClick}
        leftIcon={item.icon}
        rightIcon={item.badge}
        size="default"
        font="regular"
        className={cn(
          NAV_ITEM_CLASSES,
          'hover:bg-ods-bg-hover focus:bg-ods-bg-hover',
          'whitespace-nowrap',
          'text-ods-text-primary', // All items use primary text color
          item.isActive && 'bg-ods-bg-hover', // Active items get gray background
          item.className,
        )}
      >
        {item.label}
      </Button>
    );
  };

  const hasNav = !!config.navigation && config.navigation.items.length > 0;
  const hasCta =
    !!config.actions?.right?.length || !!(config.actions?.persistent && config.actions.persistent.length > 0);

  return (
    <div
      className={cn('sticky top-0 z-[50] w-full transition-transform duration-300 ease-in-out')}
      style={{
        transform: !show ? 'translateY(-100%)' : 'translateY(0)',
      }}
    >
      {/* Unified ODS top-navigation shell (Figma 2797-5978): 48px mobile /
          56px md+, cell model with per-cell dividers. NOTE: no `backdrop-blur`
          anywhere in this bar. Every platform ships an OPAQUE header
          background (`backgroundColor` resolves to an opaque ODS token), so a
          backdrop-filter would blur a backdrop that is then fully painted
          over: zero visual effect, but the browser still re-rasterizes the
          strip behind this sticky bar every scroll frame and content flickers
          as it passes under the header. If a consumer ever wants a
          translucent "glass" header, add the blur together with a translucent
          `backgroundColor` deliberately. */}
      <TopNavigation
        // `relative` anchors the absolutely-centered nav (position 'center')
        // to the bar itself, so the links sit at the true viewport center
        // regardless of the asymmetric CTA/Mingo cluster on the right.
        className={cn('relative', config.className)}
        style={config.style}
        backgroundClassName={config.backgroundColor}
        centerBreakpoint="lg"
        size="big"
        leading={
          <>
            {/* Length-guarded: platform configs often pass `left: []`, and an
                empty array is truthy — without the guard the cell would render
                as a bare divider + padding. */}
            {/* No padding on the wrapper: leading cells (HeaderButton-based
                admin toggles) size themselves to the bar's square cell. */}
            {!!config.actions?.left?.length && (
              <div className="flex h-full items-center border-r border-ods-border">{config.actions.left}</div>
            )}
            {/* Mobile/tablet menu toggle — a leading cell per the ODS spec
              (banded with the nav breakpoint `lg` so the desktop nav and the
              toggle never co-show). */}
            {config.mobile?.enabled && (
              <HeaderButton
                className="lg:hidden border-r border-ods-border"
                onClick={() => {
                  config.mobile?.onToggle?.();
                }}
                isActive={config.mobile?.isOpen ?? false}
                aria-label={config.mobile?.isOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={config.mobile?.isOpen ?? false}
                // Conditional: the panel unmounts when closed, so an unconditional
                // reference would dangle (axe aria-valid-attr-value).
                aria-controls={config.mobile?.isOpen ? MOBILE_NAV_PANEL_ID : undefined}
                icon={
                  config.mobile?.isOpen
                    ? config.mobile?.closeIcon || <XmarkIcon className="w-6 h-6" />
                    : config.mobile?.menuIcon || <Menu01Icon className="w-6 h-6" />
                }
              />
            )}
          </>
        }
        logo={
          <Link href={config.logo.href} className="transition-opacity duration-200 hover:opacity-80">
            {config.logo.element}
          </Link>
        }
        // Logo inset for the hub sites: 12px on mobile (the shell's base p-m),
        // 16px on tablet (mf token; the shell default is pl-l = 24px there),
        // desktop unchanged — pl-xxl, collapsed to pl-l when an always-visible
        // leading cell sits before the logo.
        // Big-bar rule (Figma 2936-6812): 24px fixed left inset on the logo
        // zone at every breakpoint — the same 24px also reads as the gap
        // between a leading cell (burger / admin toggle) and the logo.
        logoClassName="pl-[var(--spacing-system-lf)] md:pl-[var(--spacing-system-lf)] lg:pl-[var(--spacing-system-lf)]"
        center={
          hasNav ? (
            <nav
              className={cn(
                'flex items-center gap-2',
                // True centering relative to the bar (not the leftover flex
                // space) — same treatment the pre-unification header had.
                config.navigation?.position === 'center' && 'absolute left-1/2 -translate-x-1/2',
              )}
              role="navigation"
              aria-label="Main navigation"
            >
              {config.navigation?.items.map(renderNavigationItem)}
            </nav>
          ) : undefined
        }
        centerClassName={cn(
          config.navigation?.position === 'left' && 'justify-start',
          config.navigation?.position === 'right' && 'justify-end pr-[var(--spacing-system-m)]',
        )}
        cta={
          hasCta ? (
            <>
              {/* Desktop actions — banded with the nav/burger breakpoint (lg)
                  so the desktop right-cluster and the mobile toggle never
                  co-show. */}
              {!!config.actions?.right?.length && (
                <div className="hidden lg:flex items-center gap-3">{config.actions.right}</div>
              )}
              {config.actions?.persistent && config.actions.persistent.length > 0 && (
                <div className="flex items-center">{config.actions.persistent}</div>
              )}
            </>
          ) : undefined
        }
        ctaClassName="gap-3"
        sideActions={
          config.tickets || config.mingo?.enabled ? (
            <>
              {/* Support-ticket alerts cell — before Mingo, flush cell row.
                  Attention-only: renders nothing unless there are unread
                  replies (and the host mounted <TicketLiveProvider>). */}
              {config.tickets && (
                <TicketAlertsButton
                  href={config.tickets.href}
                  onNavigate={config.tickets.onClick}
                  className="border-l border-ods-border"
                />
              )}
              {config.mingo?.enabled && (
                <MingoAiButton
                  source={config.mingo.source}
                  icon={config.mingo.icon}
                  label={config.mingo.label}
                  className={config.mingo.className}
                />
              )}
            </>
          ) : undefined
        }
      />
    </div>
  );
}
