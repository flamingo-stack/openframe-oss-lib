'use client';

// Navigation component exports
// Site navigation: one data model (`SiteNav`), rendered by the header, its
// menu panels, the mobile sheet and the footer.
export { SiteHeader } from './site-header';
export type { SiteHeaderProps } from './site-header';
export { NavPanel, isMegaMenu } from './nav-panel';
export type { NavPanelProps } from './nav-panel';
export { NavItemRow } from './nav-item-row';
export type { NavItemRowProps, NavItemRowVariant } from './nav-item-row';
export { MingoAiButton } from './mingo-ai-button';
export type { MingoAiButtonProps } from './mingo-ai-button';
export { MobileNavSheet, MOBILE_NAV_SHEET_ID } from './mobile-nav-sheet';
export type { MobileNavSheetProps } from './mobile-nav-sheet';
export { SiteFooter } from './site-footer';
export type { SiteFooterProps } from './site-footer';
export { defaultRenderSiteNavLink, navLinkLabel } from './site-nav-link';
export type { SiteNavLinkRenderer } from './site-nav-link';

export { SlidingSidebar } from './sliding-sidebar';
export type { SlidingSidebarProps } from './sliding-sidebar';

export { StickySectionNav, useSectionNavigation } from './sticky-section-nav';
export type { StickyNavSection } from './sticky-section-nav';

export { NAVIGATION_SIDEBAR_WIDTH_VAR, NavigationSidebar } from './navigation-sidebar';
export type { NavigationSidebarProps } from './navigation-sidebar';

export { AppHeader } from './app-header';
export type { AppHeaderProps, HeaderLoadingCell } from './app-header';

export { AppLayout, useAppLayoutDrawerContainer } from './app-layout';
export type { AppLayoutProps } from './app-layout';

export {
  AppLayoutDrawer,
  AppLayoutDrawerTrigger,
  AppLayoutDrawerClose,
  AppLayoutDrawerContent,
  AppLayoutDrawerHeader,
  AppLayoutDrawerTitle,
  AppLayoutDrawerDescription,
  AppLayoutDrawerBody,
  AppLayoutDrawerFooter,
} from './app-layout-drawer';
export type { AppLayoutDrawerContentProps } from './app-layout-drawer';

export { MobileBurgerMenu } from './mobile-burger-menu';
export type { MobileBurgerMenuProps } from './mobile-burger-menu';

export { HeaderButton } from './header-button';
export type { HeaderButtonProps } from './header-button';
export { UnreadDot, UnreadCountBadge } from './unread-dot';
export type { UnreadDotProps, UnreadCountBadgeProps } from './unread-dot';
export { NavigationItemBadge } from './navigation-item-badge';
export type { NavigationItemBadgeProps } from './navigation-item-badge';
export { TicketAlertsButton } from './ticket-alerts-button';
export type { TicketAlertsButtonProps } from './ticket-alerts-button';

export { TopNavigation } from './top-navigation';
export type { TopNavigationProps, TopNavigationCenterBreakpoint } from './top-navigation';

export { HeaderMingoButton } from './header-mingo-button';
export type { HeaderMingoButtonProps } from './header-mingo-button';

export { HeaderGlobalSearch } from './header-global-search';
export type { HeaderGlobalSearchProps } from './header-global-search';

export { HeaderOrganizationFilter } from './header-organization-filter';
export type { HeaderOrganizationFilterOrganization, HeaderOrganizationFilterProps } from './header-organization-filter';

// Multi-level navigation — sidebar + mobile dropdown for the doc-viewer
// (DocViewer / DocSourceViewer) and any other tree-shaped navigation surface.
export { MultiLevelNavigation, MobileNavigationDropdown } from './multi-level-navigation';
export type { NavigationNode } from './multi-level-navigation';

// Re-export types from navigation types
export type {
  NavFeature,
  NavGroup,
  NavLink,
  NavMenu,
  NavigationItem,
  NavigationSidebarConfig,
  NavigationSidebarItem,
  SiteNav,
  SiteNavPrimaryCta,
  SlidingSidebarConfig,
  UnifiedSidebarUser,
} from '../../types/navigation';
