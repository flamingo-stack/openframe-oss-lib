'use client';

import { usePreventScroll } from '@react-aria/overlays';
import type React from 'react';
import { useRef, useState } from 'react';
import { resolveActiveSection } from '../../hooks/ui/use-active-section';
import { useFocusTrap } from '../../hooks/ui/use-focus-trap';
import type { NavLink, NavMenu, SiteNav } from '../../types/navigation';
import { cn } from '../../utils/cn';
import { Chevron02DownIcon } from '../icons-v2-generated/arrows/chevron-02-down-icon';
import { Chevron02RightIcon } from '../icons-v2-generated/arrows/chevron-02-right-icon';
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon';
import { Button } from '../ui/button';
import { MingoAiButton } from './mingo-ai-button';
import { MOBILE_NAV_SHEET_ID } from './mobile-nav-sheet-id';
import { NavItemRow } from './nav-item-row';
import { defaultRenderSiteNavLink, NAV_FOCUS_CLASS, type SiteNavLinkRenderer } from './site-nav-link';

export { MOBILE_NAV_SHEET_ID } from './mobile-nav-sheet-id';

export interface MobileNavSheetProps {
  nav: SiteNav;
  isOpen: boolean;
  onClose: () => void;
  /** The host router's pathname: the group holding the current page starts open. */
  pathname: string;
  logo: React.ReactNode;
  renderLink?: SiteNavLinkRenderer;
  /** The primary CTA node when `nav.primaryCta` is `'trial'` or `'waitlist'`. */
  cta?: React.ReactNode;
  /** Host nodes shown above the pinned CTA (a sign-up button). */
  actions?: React.ReactNode;
  /** The Mingo row at the top (`MingoAiButton variant="field"`): the assistant's
   *  name and icon; `source` scopes the `ask-ai:open` event. Omitted: no row. */
  askAI?: { source?: string; icon?: React.ReactNode; label: string };
  /** Host-added groups after the site's own (Profile, Admin). */
  extraMenus?: NavMenu[];
  /** Values for `NavLink.badgeKey`. */
  badges?: Record<string, number>;
  /** Rendered under the links of a menu with `showSocial`. */
  social?: React.ReactNode;
  /** Opaque ODS background class. Default `bg-ods-bg`. */
  backgroundClassName?: string;
}

const GROUP_ROW_CLASS =
  'flex min-h-14 w-full items-center justify-between gap-[var(--spacing-system-sf)] text-left text-ods-text-primary text-h4';

const menuLinks = (menu: NavMenu): NavLink[] => [
  ...(menu.columns ?? []).flatMap(group => group.links),
  ...(menu.sideLinks ?? []),
];

/**
 * The site navigation below `lg`: a full-screen sheet drawn from the same
 * `SiteNav` as the header. Each menu with links is an accordion that expands
 * in place; the primary CTA and Sign in stay pinned at the bottom while the
 * body scrolls.
 *
 * Unmounted while closed (the header's panels are what crawlers read).
 */
export function MobileNavSheet(props: MobileNavSheetProps) {
  // The open groups are seeded from the page the sheet opens on, so the body
  // mounts with the sheet: every open starts from the current section.
  if (!props.isOpen) return null;
  return <MobileNavSheetBody {...props} />;
}

function MobileNavSheetBody({
  nav,
  onClose,
  pathname,
  logo,
  renderLink = defaultRenderSiteNavLink,
  cta,
  actions,
  askAI,
  extraMenus,
  badges,
  social,
  backgroundClassName,
}: MobileNavSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const menus = [...(nav.mobileMenus ?? nav.menus), ...(extraMenus ?? [])];

  // Shared ref-counted, iOS-aware scroll lock (react-aria): one counter with
  // the modals and chat overlays, restores prior styles on release.
  usePreventScroll();
  // Initial focus, Tab containment, Escape-to-close, guarded focus restore.
  useFocusTrap(sheetRef, true, { onEscape: onClose });

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const active = resolveActiveSection(menus, pathname);
    return active ? { [active]: true } : {};
  });

  const primaryCta =
    typeof nav.primaryCta === 'object' ? (
      <Button variant="accent" href={nav.primaryCta.href} onClick={onClose} className="w-full">
        {nav.primaryCta.label}
      </Button>
    ) : nav.primaryCta === 'none' ? null : (
      (cta ?? null)
    );
  const hasFooter = !!actions || !!primaryCta || !!nav.signIn;

  return (
    <div
      ref={sheetRef}
      id={MOBILE_NAV_SHEET_ID}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
      tabIndex={-1}
      // Small-viewport height: 100vh overflowed under mobile browser chrome,
      // leaving the pinned CTA unreachable while the body was scroll-locked.
      className={cn(
        'fixed inset-0 z-[9999] flex h-[100svh] flex-col text-ods-text-primary outline-none',
        backgroundClassName ?? 'bg-ods-bg',
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-ods-border pl-5 pr-[var(--spacing-system-xsf)]">
        <div className="flex min-w-0 items-center">{logo}</div>
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ods-text-primary transition-colors hover:bg-ods-bg-hover',
            NAV_FOCUS_CLASS,
          )}
        >
          <XmarkIcon aria-hidden="true" className="h-6 w-6" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5">
        {askAI && (
          <MingoAiButton
            variant="field"
            source={askAI.source}
            icon={askAI.icon}
            label={askAI.label}
            onClick={onClose}
          />
        )}

        <nav aria-label="Main">
          {menus.map(menu => {
            const links = menuLinks(menu);
            if (links.length === 0) {
              if (!menu.href) return null;
              return (
                <div key={menu.id} className="border-b border-ods-border">
                  {renderLink({
                    link: { href: menu.href },
                    className: cn(GROUP_ROW_CLASS, NAV_FOCUS_CLASS),
                    onClick: onClose,
                    children: (
                      <>
                        {menu.label}
                        <Chevron02RightIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-ods-text-muted" />
                      </>
                    ),
                  })}
                </div>
              );
            }

            const open = !!openGroups[menu.id];
            const listId = `${MOBILE_NAV_SHEET_ID}-${menu.id}`;
            return (
              <div key={menu.id} className="border-b border-ods-border">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={open ? listId : undefined}
                  onClick={() => setOpenGroups(prev => ({ ...prev, [menu.id]: !prev[menu.id] }))}
                  className={cn(GROUP_ROW_CLASS, NAV_FOCUS_CLASS)}
                >
                  {menu.label}
                  <Chevron02DownIcon
                    aria-hidden="true"
                    className={cn(
                      'h-5 w-5 shrink-0 text-ods-text-muted transition-transform duration-150',
                      open && 'rotate-180',
                    )}
                  />
                </button>
                {open && (
                  <div id={listId} className="flex flex-col pb-[var(--spacing-system-sf)]">
                    {links.map(link => (
                      <NavItemRow
                        key={link.id}
                        link={link}
                        variant="sheet"
                        renderLink={renderLink}
                        badge={link.badgeKey ? badges?.[link.badgeKey] : undefined}
                        onNavigate={onClose}
                      />
                    ))}
                    {menu.showSocial && social && <div className="pt-[var(--spacing-system-xsf)]">{social}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Pinned: stays visible while the body scrolls, clears the iOS home indicator. */}
      {hasFooter && (
        <div className="flex shrink-0 flex-col gap-[var(--spacing-system-xxs)] border-t border-ods-border px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-[var(--spacing-system-mf)] [&_a]:w-full [&_button]:w-full">
          {actions}
          {primaryCta}
          {nav.signIn &&
            renderLink({
              link: nav.signIn,
              className: cn(
                'flex h-12 items-center justify-center rounded-md text-ods-text-primary text-h4',
                NAV_FOCUS_CLASS,
              ),
              onClick: onClose,
              children: nav.signIn.label,
            })}
        </div>
      )}
    </div>
  );
}
