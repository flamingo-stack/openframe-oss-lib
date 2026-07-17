"use client"

import React, { useRef } from 'react'
import { usePreventScroll } from '@react-aria/overlays'
import { cn } from '../../utils'
import { MobileNavConfig, NavigationItem } from '../../types/navigation'
import { Button } from '../ui/button'
import { OVERLAY_BACKDROP_CLASS } from '../ui/drawer'
import { useFocusTrap } from '../../hooks/ui/use-focus-trap'
import { useHeaderHeight } from '../../hooks/ui/use-header-height'
import { X } from 'lucide-react'

/** DOM id of the panel — referenced by the header hamburger's `aria-controls`. */
export const MOBILE_NAV_PANEL_ID = 'mobile-nav-panel'

export interface MobileNavPanelProps {
  isOpen: boolean
  config: MobileNavConfig
}

export function MobileNavPanel({ isOpen, config }: MobileNavPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Shared ref-counted, iOS-aware scroll lock (react-aria) — one counter with
  // the modals and chat overlays, restores prior styles on release.
  usePreventScroll({ isDisabled: !isOpen })
  // Initial focus, Tab containment, Escape-to-close, guarded focus restore.
  useFocusTrap(panelRef, isOpen, { onEscape: config.onClose })
  // The panel is layout-mounted on every page — observers only while open.
  const headerHeight = useHeaderHeight(64, { enabled: isOpen })

  if (!isOpen) return null

  const renderNavigationItem = (item: NavigationItem) => {
    if (item.element) {
      return <div key={item.id}>{item.element}</div>
    }

    const handleClick = () => {
      if (item.onClick) {
        item.onClick()
      }
      config.onClose?.()
    }

    if (item.href) {
      return (
        <Button
          key={item.id}
          variant="outline"
          size="small-legacy"
          href={item.href}
          onClick={handleClick}
          leftIcon={item.icon}
          rightIcon={item.badge}
          className={cn(
            "justify-start h-12 px-4 bg-transparent border-none text-ods-text-primary hover:bg-ods-bg-hover gap-3 rounded-md transition-colors",
            item.isActive ? "bg-ods-bg-hover" : ""
          )}
        >
          {item.label}
        </Button>
      )
    }

    return (
      <Button
        key={item.id}
        variant="outline"
        size="small-legacy"
        onClick={handleClick}
        leftIcon={item.icon}
        className={cn(
          "justify-start h-12 px-4 bg-transparent border-none text-ods-text-primary hover:bg-ods-bg-hover gap-3 rounded-md transition-colors",
          item.isActive ? "bg-ods-bg-hover" : ""
        )}
      >
        <span className="flex-1 text-left">{item.label}</span>
        {item.badge !== undefined && (
          <span className="ml-auto">{item.badge}</span>
        )}
      </Button>
    )
  }

  return (
    <>
      {/* Backdrop - closes nav when clicked outside */}
      <div
        className={cn("fixed inset-0 z-[9998]", OVERLAY_BACKDROP_CLASS)}
        onClick={config.onClose}
      />

      {/* Navigation Panel - top-anchored floating card */}
      <div
        ref={panelRef}
        id={MOBILE_NAV_PANEL_ID}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        tabIndex={-1}
        style={{ '--mobile-nav-top': `${headerHeight + 16}px` } as React.CSSProperties}
        className={cn(
          "fixed z-[9999] rounded-lg shadow-xl",
          config.className ? "" : "bg-ods-card border border-ods-border",
          // Responsive positioning and sizing
          "right-2 left-2 md:left-auto",
          "md:right-6 md:w-[400px] md:max-w-[calc(100vw-3rem)]",
          // Small-viewport (svh) sizing anchored below the measured header —
          // 100vh overflowed under mobile browser chrome, leaving the bottom
          // entries and footer unreachable while the body was scroll-locked.
          "top-[var(--mobile-nav-top)]",
          "max-h-[calc(100svh-var(--mobile-nav-top)-50px)] md:max-h-[calc(100svh-var(--mobile-nav-top)-8px)]",
          "flex flex-col",
          config.className || ""
        )}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside nav
      >
        {/* Header with close button - fixed at top */}
        <div className="flex justify-end p-2 border-b border-ods-border flex-shrink-0">
          <Button
            aria-label="Close menu"
            size="icon"
            variant="transparent"
            leftIcon={<X className="w-4 h-4 text-ods-text-primary" />}
            onClick={config.onClose}
            className="hover:bg-ods-bg-hover"
          />
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2 py-2">
          <div className="flex flex-col space-y-1">
            {config.sections.map((section, index) => (
              <div key={index}>
                {section.title && (
                  <div className="px-4 pt-2 pb-1 text-h6 font-semibold uppercase text-ods-text-secondary">
                    {section.title}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  {section.items.map(renderNavigationItem)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer with action button - fixed at bottom, clears the iOS home indicator */}
        {config.footer && (
          <div className="border-t border-ods-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex-shrink-0">
            {config.footer}
          </div>
        )}
      </div>
    </>
  )
}