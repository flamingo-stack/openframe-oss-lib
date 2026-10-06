'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useActiveSection } from '../../hooks/ui/use-active-section';
import { useNavMenus } from '../../hooks/ui/use-nav-menus';
import type { NavMenu, SiteNav } from '../../types/navigation';
import { cn } from '../../utils/cn';
import { EntityIcon } from '../icon-display';
import { Chevron02DownIcon } from '../icons-v2-generated/arrows/chevron-02-down-icon';
import { Menu01Icon } from '../icons-v2-generated/interface/menu-01-icon';
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon';
import { Button } from '../ui/button';
import { HeaderButton } from './header-button';
import { MingoAiButton } from './mingo-ai-button';
import { MOBILE_NAV_SHEET_ID } from './mobile-nav-sheet-id';
import { isMegaMenu, NavPanel, type NavPanelMotion } from './nav-panel';
import { defaultRenderSiteNavLink, NAV_FOCUS_CLASS, type SiteNavLinkRenderer } from './site-nav-link';
import { TopNavigation } from './top-navigation';

export interface SiteHeaderProps {
  nav: SiteNav;
  /** The host router's pathname: marks the active section and closes menus on navigation. */
  pathname: string;
  logo: React.ReactNode;
  /** Omitted: the logo is not a link. */
  logoHref?: string;
  /** The host's link (Next `Link`, unified navigation). Default: `<a>`. */
  renderLink?: SiteNavLinkRenderer;
  /** Leading cells (admin sidebar toggle). Each cell owns its divider. */
  leading?: React.ReactNode;
  /** Host actions at the right (profile button, custom buttons). Shown at every width. */
  actions?: React.ReactNode;
  /** The primary CTA node when `nav.primaryCta` is `'trial'` or `'waitlist'`. */
  cta?: React.ReactNode;
  /** Trailing cells (ticket alerts). Each cell owns its divider. */
  sideActions?: React.ReactNode;
  /**
   * The Mingo AI launcher, the last trailing cell at the far right edge.
   * Omitted: no launcher. `icon` and `label` are the server-configured
   * assistant identity (the same ones the chat panel shows); `source` scopes
   * the `ask-ai:open` event the launcher dispatches.
   */
  mingo?: { source?: string; icon?: React.ReactNode; label?: string; shortcutHint?: boolean; className?: string };
  /** Omitted: no burger. */
  mobile?: { isOpen: boolean; onToggle: () => void; controlsId?: string };
  /** Values for `NavLink.badgeKey`. */
  badges?: Record<string, number>;
  /** Rendered under a menu with `showSocial`. */
  social?: React.ReactNode;
  autoHide?: boolean;
  /** Opaque ODS background class. */
  backgroundClassName?: string;
  className?: string;
  style?: React.CSSProperties;
  /** The id the "Skip to content" link targets. Default `main-content`. */
  skipToContentId?: string;
}

// A top-level item (prototype `.nv-l`): 40px tall, quiet until hovered, open
// or current.
const TOP_ITEM_CLASS =
  'relative inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 text-ods-text-secondary transition-colors text-h6 hover:bg-ods-bg-hover hover:text-ods-text-primary';
// The current section: a 2px accent underline and an accent wash.
const TOP_ITEM_CURRENT_CLASS =
  'rounded-b-none bg-gradient-to-b from-transparent to-ods-accent/10 text-ods-text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-ods-accent';

/** A top-level item's optional glyph (`NavMenu.iconName`), before its label. */
const menuIcon = (menu: NavMenu) =>
  menu.iconName ? <EntityIcon icon={{ name: menu.iconName }} size={20} className="size-5 shrink-0" /> : null;

/**
 * The site header of every platform, drawn from one `SiteNav`: logo, the
 * menus left-aligned after it, then Sign in, the host's actions, the primary
 * CTA (the only button) and the trailing cells, the Mingo AI launcher last. A
 * platform differs only in the data and the slots it passes.
 *
 * Below `lg` the menus and Sign in leave the bar (they live in
 * `MobileNavSheet`); the host's actions, the CTA and the launcher stay.
 */
export function SiteHeader({
  nav,
  pathname,
  logo,
  logoHref,
  renderLink = defaultRenderSiteNavLink,
  leading,
  actions,
  cta,
  sideActions,
  mingo,
  mobile,
  badges,
  social,
  autoHide = false,
  backgroundClassName,
  className,
  style,
  skipToContentId = 'main-content',
}: SiteHeaderProps) {
  const [show, setShow] = useState(true);
  // Not state: nothing renders the previous offset, and as `useState` it
  // re-rendered the whole header on every scroll event just to store a number.
  const lastScrollY = useRef(0);

  const activeId = useActiveSection(nav.menus, pathname);
  const { openId, close, getTriggerProps, getPanelProps } = useNavMenus({ pathname });

  // The menu that was open before this one, kept during render (no effect, no
  // late frame): it tells an opening mega menu which side its content comes from.
  const [trail, setTrail] = useState<{ id: string | null; from: string | null }>({ id: null, from: null });
  if (trail.id !== openId) setTrail({ id: openId, from: trail.id });
  const previousId = trail.id === openId ? trail.from : trail.id;
  const megaIds = nav.menus.filter(isMegaMenu).map(menu => menu.id);
  const openMegaIndex = openId === null ? -1 : megaIds.indexOf(openId);
  const previousMegaIndex = previousId === null ? -1 : megaIds.indexOf(previousId);
  const megaMotion: NavPanelMotion =
    openMegaIndex < 0 || previousMegaIndex < 0 ? 'open' : openMegaIndex > previousMegaIndex ? 'from-end' : 'from-start';

  useEffect(() => {
    // Only add the scroll listener while auto-hide is on. Nothing to reset
    // here: `show` is masked by `autoHide` where it is read (`headerShown`), so
    // turning auto-hide off can never leave the header stuck off-screen.
    if (!autoHide) return undefined;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const prevScrollY = lastScrollY.current;
      lastScrollY.current = currentScrollY;

      if (currentScrollY > prevScrollY && currentScrollY > 50) setShow(false);
      else if (currentScrollY < prevScrollY || currentScrollY <= 10) setShow(true);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [autoHide]);

  // An open menu holds the header in place: hiding the bar would take the
  // panel the visitor is reading with it.
  const headerShown = !autoHide || show || openId !== null;

  const renderMenu = (menu: NavMenu) => {
    const current = menu.id === activeId;
    const hasPanel = !!menu.columns?.length || !!menu.features?.length || !!menu.sideLinks?.length;

    if (!hasPanel) {
      if (!menu.href) return null;
      return (
        <div key={menu.id} className="flex">
          {renderLink({
            link: { href: menu.href },
            className: cn(TOP_ITEM_CLASS, NAV_FOCUS_CLASS, current && TOP_ITEM_CURRENT_CLASS),
            'aria-current': current ? 'page' : undefined,
            children: (
              <>
                {menuIcon(menu)}
                {menu.label}
              </>
            ),
          })}
        </div>
      );
    }

    const open = openId === menu.id;
    return (
      // A dropdown is anchored to its trigger (`relative`); a mega menu to the
      // bar itself, so its wrapper stays unpositioned.
      <div key={menu.id} className={cn('flex', !isMegaMenu(menu) && 'relative')}>
        <button
          type="button"
          {...getTriggerProps(menu.id)}
          aria-current={current ? 'page' : undefined}
          className={cn(
            TOP_ITEM_CLASS,
            NAV_FOCUS_CLASS,
            open && 'bg-ods-bg-hover text-ods-text-primary',
            current && TOP_ITEM_CURRENT_CLASS,
          )}
        >
          {menuIcon(menu)}
          {menu.label}
          <Chevron02DownIcon
            aria-hidden="true"
            className={cn('h-4 w-4 transition-transform duration-150', open && 'rotate-180')}
          />
        </button>
        <NavPanel
          {...getPanelProps(menu.id)}
          menu={menu}
          open={open}
          motion={open ? megaMotion : undefined}
          handoff={openMegaIndex >= 0}
          renderLink={renderLink}
          badges={badges}
          social={social}
          onNavigate={close}
        />
      </div>
    );
  };

  const primaryCta =
    typeof nav.primaryCta === 'object' ? (
      <Button variant="accent" href={nav.primaryCta.href}>
        {nav.primaryCta.label}
      </Button>
    ) : nav.primaryCta === 'none' ? null : (
      (cta ?? null)
    );
  const hasRight = !!mingo || !!nav.signIn || !!actions || !!primaryCta;

  return (
    <div
      className="sticky top-0 z-[50] w-full transition-transform duration-300 ease-in-out"
      style={{ transform: headerShown ? 'translateY(0)' : 'translateY(-100%)' }}
    >
      {/* First tab stop of the page; visible only while focused. */}
      <a
        href={`#${skipToContentId}`}
        className={cn(
          'sr-only left-[var(--spacing-system-lf)] top-3 z-[70] rounded-md bg-ods-text-primary px-[var(--spacing-system-mf)] py-[var(--spacing-system-xsf)] text-ods-bg text-h6 focus:not-sr-only focus:absolute',
          NAV_FOCUS_CLASS,
        )}
      >
        Skip to content
      </a>
      {/* Unified ODS top-navigation shell (Figma 2797-5978), cell model with
          per-cell dividers. NOTE: no `backdrop-blur` anywhere in this bar.
          Every platform ships an OPAQUE header background, so a
          backdrop-filter would blur a backdrop that is then fully painted
          over: zero visual effect, but the browser still re-rasterizes the
          strip behind this sticky bar every scroll frame and content flickers
          as it passes under the header. A translucent "glass" header needs
          the blur and a translucent `backgroundClassName` together. */}
      <TopNavigation
        // `relative` anchors a mega menu to the bar: it opens full width
        // right under it.
        className={cn('relative', className)}
        style={style}
        backgroundClassName={backgroundClassName}
        centerBreakpoint="lg"
        size="big"
        leading={
          <>
            {leading}
            {/* Menu toggle: a leading cell, banded with the menus' breakpoint
                (`lg`) so the desktop menus and the toggle never co-show. */}
            {mobile && (
              <HeaderButton
                className="border-r border-ods-border lg:hidden"
                onClick={mobile.onToggle}
                isActive={mobile.isOpen}
                aria-label={mobile.isOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobile.isOpen}
                // Conditional: the sheet unmounts when closed, so an
                // unconditional reference would dangle (axe aria-valid-attr-value).
                aria-controls={mobile.isOpen ? (mobile.controlsId ?? MOBILE_NAV_SHEET_ID) : undefined}
                icon={mobile.isOpen ? <XmarkIcon className="h-6 w-6" /> : <Menu01Icon className="h-6 w-6" />}
              />
            )}
          </>
        }
        logo={
          logoHref
            ? renderLink({
                link: { href: logoHref },
                className: cn(
                  'flex min-w-0 items-center rounded-md transition-opacity duration-200 hover:opacity-80',
                  NAV_FOCUS_CLASS,
                ),
                'aria-label': nav.brand.name,
                children: logo,
              })
            : logo
        }
        // Big-bar rule (Figma 2936-6812): a fixed 24px left inset on the logo
        // zone at every breakpoint, which also reads as the gap between a
        // leading cell and the logo. `shrink` lets the logo, never the CTA,
        // give way on the narrowest phones.
        logoClassName="shrink pl-[var(--spacing-system-lf)] md:pl-[var(--spacing-system-lf)] lg:pl-[var(--spacing-system-lf)]"
        center={
          nav.menus.length > 0 ? (
            <nav aria-label="Main" className="flex items-center gap-[var(--spacing-system-xxs)]">
              {nav.menus.map(renderMenu)}
            </nav>
          ) : undefined
        }
        centerClassName="justify-start pl-[var(--spacing-system-xlf)]"
        cta={
          hasRight ? (
            <>
              {mingo && (
                <MingoAiButton
                  source={mingo.source}
                  icon={mingo.icon}
                  label={mingo.label}
                  shortcutHint={mingo.shortcutHint}
                  className={mingo.className}
                />
              )}
              {nav.signIn && (
                <div className="hidden lg:flex">
                  {renderLink({
                    link: nav.signIn,
                    className: cn(TOP_ITEM_CLASS, NAV_FOCUS_CLASS),
                    children: nav.signIn.label,
                  })}
                </div>
              )}
              {actions}
              {primaryCta}
            </>
          ) : undefined
        }
        ctaClassName="gap-[var(--spacing-system-xsf)]"
        sideActions={sideActions}
      />
    </div>
  );
}
