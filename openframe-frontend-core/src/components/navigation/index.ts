// Navigation component exports
export { Header } from './header'
export type { HeaderProps, HeaderConfig } from './header'

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

// Re-export types from navigation types
export type { 
  NavigationItem, 
  MobileNavConfig, 
  SlidingSidebarConfig,
  NavigationSidebarConfig,
  NavigationSidebarItem 
} from '../../types/navigation'