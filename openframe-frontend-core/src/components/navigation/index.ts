// Navigation component exports
export { Header } from './header'
export type { HeaderConfig, HeaderProps } from './header'

export { ClientOnlyHeader } from './client-only-header'
export type { ClientOnlyHeaderProps } from './client-only-header'

export { HeaderSkeleton } from './header-skeleton'
export type { HeaderSkeletonProps } from './header-skeleton'

export { MobileNavPanel } from './mobile-nav-panel'
export type { MobileNavPanelProps } from './mobile-nav-panel'

export { SlidingSidebar } from './sliding-sidebar'
export type { SlidingSidebarProps } from './sliding-sidebar'

export { StickySectionNav, useSectionNavigation } from './sticky-section-nav'
export type { StickyNavSection } from './sticky-section-nav'

export { NavigationSidebar } from './navigation-sidebar'
export type { NavigationSidebarProps } from './navigation-sidebar'

export { AppHeader } from './app-header'
export type { AppHeaderProps } from './app-header'

export { AppLayout } from './app-layout'
export type { AppLayoutProps } from './app-layout'

export { MobileBurgerMenu } from './mobile-burger-menu'
export type { MobileBurgerMenuProps } from './mobile-burger-menu'

export { HeaderButton } from './header-button'
export type { HeaderButtonProps } from './header-button'

export { HeaderGlobalSearch } from './header-global-search'
export type { HeaderGlobalSearchProps } from './header-global-search'

export { HeaderOrganizationFilter } from './header-organization-filter'
export type { HeaderOrganizationFilterOrganization, HeaderOrganizationFilterProps } from './header-organization-filter'

// Re-export types from navigation types
export type {
  MobileNavConfig, NavigationItem, NavigationSidebarConfig,
  NavigationSidebarItem, SlidingSidebarConfig, UnifiedSidebarUser
} from '../../types/navigation'
