"use client"

import React, { useEffect, useRef } from 'react'
import { cn } from '../../utils'
import { MobileNavConfig, NavigationItem } from '../../types/navigation'
import { Button } from '../ui/button'
import { X } from 'lucide-react'

export interface MobileNavPanelProps {
  isOpen: boolean
  config: MobileNavConfig
}

export function MobileNavPanel({ isOpen, config }: MobileNavPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Prevent body scroll when menu is open - using the original working approach
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        config.onClose?.()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, config])

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
          size="sm"
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
        size="sm"
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
        className="fixed inset-0 z-[9998] bg-black/50"
        onClick={config.onClose}
      />

      {/* Navigation Panel - modal style like the original working version */}
      <div
        ref={panelRef}
        className={cn(
          "fixed z-[9999] rounded-lg shadow-xl",
          config.className ? "" : "bg-ods-card border border-ods-border",
          // Responsive positioning and sizing - matching original working version
          "right-2 left-2 sm:right-4 sm:left-auto sm:w-96 sm:max-w-[calc(100vw-2rem)]",
          "md:right-6 md:w-[400px] md:max-w-[calc(100vw-3rem)]",
          // Height constraints with proper mobile spacing - increased top position
          "top-20 max-h-[calc(100vh-130px)] sm:max-h-[calc(100vh-88px)]",
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
            variant="ghost"
            centerIcon={<X className="w-4 h-4 text-ods-text-primary" />}
            onClick={config.onClose}
            className="hover:bg-ods-bg-hover"
          />
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">
          <div className="flex flex-col space-y-1">
            {config.sections.map((section, index) => (
              <div key={index}>
                {section.title && (
                  <div className="px-4 pt-2 pb-1 text-xs font-semibold text-ods-text-secondary uppercase tracking-wide">
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

        {/* Footer with action button - fixed at bottom */}
        {config.footer && (
          <div className="border-t border-ods-border p-4 flex-shrink-0">
            {config.footer}
          </div>
        )}
      </div>
    </>
  )
}