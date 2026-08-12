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
  /** Support-ticket alerts cell (`TicketAlertsButton`), rendered before
   *  the Mingo launcher in the flush cell row. Attention-only: renders
   *  nothing unless a `<TicketLiveProvider>` is mounted AND there are
   *  unread support replies — declaring it is side-effect-free. */
  tickets?: {
    /** BASE path of the tickets surface (any nesting prefix allowed —
     *  '/tickets', '/support/portal/tickets'). The cell builds the SSOT
     *  deep link `<href>?ticket=<id>` for the newest-unread ticket. */
    href: string
    /** Optional host navigation (router push) — receives the FULL
     *  computed href. Defaults to `window.location.assign`. */
    onClick?: (href: string) => void
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
  /**
   * Draw placeholder rows instead of `items`.
   *
   * For hosts whose navigation is not knowable at first paint — entries gated by
   * server-loaded feature flags, permissions, or tenant config. Such a host has no
   * good option without this: rendering the items it has yet means a nav that grows
   * and shifts as answers arrive, and guessing the gated ones wrong shows entries
   * that don't belong to the user (a flag that HIDES a legacy entry when enabled
   * makes "not answered yet" indistinguishable from "off").
   *
   * The rows reuse the real entry's geometry and the sidebar's own minimized state,
   * so the placeholder is correct in both the expanded and the minimized rail with
   * nothing to pass in — and the handoff to the real nav moves nothing.
   */
  loading?: boolean
  /**
   * How many placeholder rows `loading` draws, per section. Defaults to 7 primary
   * and 2 secondary — the shape of a typical console nav. Pass the counts the host
   * expects so the placeholder and the loaded nav are the same height.
   */
  loadingRows?: { primary?: number; secondary?: number }
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