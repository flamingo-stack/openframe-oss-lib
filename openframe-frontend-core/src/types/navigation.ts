import React from 'react'

/**
 * Base navigation item interface used across all navigation components
 */
export interface NavigationItem {
  id: string
  label: string
  href?: string
  icon?: React.ReactNode
  badge?: React.ReactNode | number | string
  isActive?: boolean
  children?: NavigationItem[]
  onClick?: () => void
  element?: React.ReactNode // For completely custom navigation items
  isExternal?: boolean // For external links that open in new tab
  type?: 'single' | 'dropdown' // Type of navigation item
  dropdownContent?: React.ReactNode // Additional content for dropdown (e.g., social icons)
  showDropdownDivider?: boolean // Whether to show divider above dropdown content
  className?: string // Custom CSS classes to override default styling
  dropdownClassName?: string // Custom CSS classes for dropdown menu background
}

/**
 * Configuration for the header component
 */
export interface HeaderConfig {
  logo: {
    element: React.ReactNode
    href: string
  }
  navigation?: {
    items: NavigationItem[]
    position?: 'left' | 'center' | 'right'
  }
  actions?: {
    left?: React.ReactNode[]
    right?: React.ReactNode[]
    persistent?: React.ReactNode[]
  }
  mobile?: {
    enabled: boolean
    menuIcon?: React.ReactNode
    closeIcon?: React.ReactNode
    onToggle?: () => void
    isOpen?: boolean
  }
  mingo?: {
    enabled?: boolean
    source?: string
    className?: string
    /** Server-configured Mingo identity glyph (same EntityIcon the chat
     *  panel renders); omit to use the packaged fallback mark. */
    icon?: React.ReactNode
    /** Server-configured assistant name for the wordmark/aria-label; omit
     *  for the default "Mingo AI". */
    label?: string
  }
  className?: string
  style?: React.CSSProperties
  autoHide?: boolean
  backgroundColor?: string  // ODS background color (e.g., 'bg-ods-card', 'bg-ods-accent')
}

/**
 * Configuration for the mobile navigation panel
 */
export interface MobileNavConfig {
  sections: Array<{
    title?: string
    items: NavigationItem[]
  }>
  footer?: React.ReactNode
  className?: string
  onClose?: () => void
}

/**
 * Configuration for the sliding sidebar component
 */
export interface SlidingSidebarConfig {
  items: NavigationItem[]
  footer?: React.ReactNode
  isOpen: boolean
  onClose: () => void
  position?: 'left' | 'right'
  className?: string
}

/**
 * Configuration for the navigation sidebar component
 */
export interface NavigationSidebarConfig {
  items: NavigationSidebarItem[]
  minimized?: boolean
  onNavigate?: (path: string) => void
  onToggleMinimized?: () => void
  className?: string
}

/**
 * Navigation sidebar item interface
 */
export interface NavigationSidebarItem {
  id: string
  label: string
  icon: React.ReactNode
  path?: string
  unreadCount?: number
  isActive?: boolean
  onClick?: () => void
  children?: NavigationSidebarItem[]
  section?: 'primary' | 'secondary' // To separate top and bottom sections
}

/**
 * User information for the unified sidebar
 */
export interface UnifiedSidebarUser {
  name?: string
  email?: string
  avatarUrl?: string | null
  role?: string
}