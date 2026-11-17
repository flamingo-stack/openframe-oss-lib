import type { SiteNav } from '../../types/navigation';

/**
 * Would the mobile sheet list anything from this navigation? The header's menu button and the sheet read this one
 * answer (plus whatever the host adds: a profile entry, a sign-up button), so a button never opens an empty sheet.
 *
 * A module of its own, apart from `MobileNavSheet`: a host asks this on every page to draw the menu button, and loads
 * the sheet itself only once it is opened.
 */
export function siteNavHasMobileMenus(nav: Pick<SiteNav, 'menus' | 'mobileMenus'>): boolean {
  return (nav.mobileMenus ?? nav.menus).length > 0;
}
