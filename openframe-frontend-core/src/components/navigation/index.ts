'use client';

// Re-export types from navigation types
export type {
  MobileNavConfig,
  NavigationItem,
  NavigationSidebarConfig,
  NavigationSidebarItem,
  SlidingSidebarConfig,
  UnifiedSidebarUser,
} from '../../types/navigation';
export type { AppHeaderProps } from './app-header';
export { AppHeader } from './app-header';
export type { AppLayoutProps } from './app-layout';
export { AppLayout } from './app-layout';
export type { ClientOnlyHeaderProps } from './client-only-header';
export { ClientOnlyHeader } from './client-only-header';
export type { HeaderConfig, HeaderProps } from './header';
// Navigation component exports
export { Header } from './header';
export type { HeaderButtonProps } from './header-button';
export { HeaderButton } from './header-button';
export type { HeaderGlobalSearchProps } from './header-global-search';
export { HeaderGlobalSearch } from './header-global-search';
export type { HeaderOrganizationFilterOrganization, HeaderOrganizationFilterProps } from './header-organization-filter';
export { HeaderOrganizationFilter } from './header-organization-filter';
export type { HeaderSkeletonProps } from './header-skeleton';
export { HeaderSkeleton } from './header-skeleton';
export type { MobileBurgerMenuProps } from './mobile-burger-menu';

export { MobileBurgerMenu } from './mobile-burger-menu';
export type { MobileNavPanelProps } from './mobile-nav-panel';
export { MobileNavPanel } from './mobile-nav-panel';
export type { NavigationSidebarProps } from './navigation-sidebar';
export { NavigationSidebar } from './navigation-sidebar';
export type { SlidingSidebarProps } from './sliding-sidebar';
export { SlidingSidebar } from './sliding-sidebar';
export type { StickyNavSection } from './sticky-section-nav';
export { StickySectionNav, useSectionNavigation } from './sticky-section-nav';
