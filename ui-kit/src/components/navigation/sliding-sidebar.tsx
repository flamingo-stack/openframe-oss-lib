"use client"

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../utils'
import { SlidingSidebarConfig, NavigationItem } from '../../types/navigation'
import { Button } from '../ui/button'

export interface SlidingSidebarProps {
  config: SlidingSidebarConfig
}

export function SlidingSidebar({ config }: SlidingSidebarProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)
  const [headerHeight, setHeaderHeight] = useState(64) // Default to 64px

  useEffect(() => {
    setMounted(true)
    
    // Function to calculate total header height
    const calculateHeaderHeight = () => {
      let totalHeight = 0
      
      // Find and measure the header
      const header = document.querySelector('header')
      if (header) {
        totalHeight += header.offsetHeight
      }
      
      // Find and measure the announcement bar (if exists)
      const announcementBar = document.querySelector('[data-announcement-bar]')
      if (announcementBar && announcementBar instanceof HTMLElement) {
        totalHeight += announcementBar.offsetHeight
      }
      
      // Update the header height if we found elements
      if (totalHeight > 0) {
        setHeaderHeight(totalHeight)
      } else {
        // If no header found, default to 64px
        setHeaderHeight(64)
      }
    }
    
    // Calculate initial height with a small delay to ensure elements are rendered
    setTimeout(calculateHeaderHeight, 100)
    
    // Also calculate immediately in case elements are already there
    calculateHeaderHeight()
    
    // Recalculate on window resize
    window.addEventListener('resize', calculateHeaderHeight)
    
    // Use ResizeObserver to detect header size changes
    const resizeObserver = new ResizeObserver(calculateHeaderHeight)
    
    // Observe header
    const header = document.querySelector('header')
    if (header) {
      resizeObserver.observe(header)
    }
    
    // Observe announcement bar
    const announcementBar = document.querySelector('[data-announcement-bar]')
    if (announcementBar) {
      resizeObserver.observe(announcementBar)
    }
    
    // Use MutationObserver to detect when announcement bar is added/removed
    const mutationObserver = new MutationObserver((mutations) => {
      // Check if announcement bar was added or removed
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // Recalculate height when DOM changes
          calculateHeaderHeight()
          
          // If announcement bar was added, start observing it
          const newAnnouncementBar = document.querySelector('[data-announcement-bar]')
          if (newAnnouncementBar) {
            resizeObserver.observe(newAnnouncementBar)
          }
        }
      }
    })
    
    // Observe the body for changes (announcement bar might be added/removed)
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    })
    
    return () => {
      window.removeEventListener('resize', calculateHeaderHeight)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [])

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  const renderMenuItem = (item: NavigationItem, level = 0): React.ReactNode => {
    // If custom element provided, render it
    if (item.element) {
      return <div key={item.id}>{item.element}</div>
    }

    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.has(item.id)

    if (hasChildren) {
      const chevronIcon = (
        <svg 
          className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )

      return (
        <div key={item.id} className="space-y-1">
          <Button
            variant="ghost-nav"
            size="default"
            onClick={() => toggleExpanded(item.id)}
            leftIcon={item.icon}
            rightIcon={chevronIcon}
            className={cn(
              "!w-full sm:!w-full rounded-lg transition-colors",
              level === 0 ? "pl-3" : "pl-6",
              item.isActive ? "bg-ods-accent text-ods-text-on-accent hover:bg-ods-accent/90" : "text-ods-text-primary hover:bg-ods-border"
            )}
          >
            {item.label}
            {item.badge !== undefined && (
              <span className="ml-auto mr-2">{item.badge}</span>
            )}
          </Button>
          
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ 
                  duration: 0.15, 
                  ease: "easeOut",
                  height: { duration: 0.2 },
                  opacity: { duration: 0.1 }
                }}
                className="overflow-hidden"
              >
                <div className="space-y-1 pl-4">
                  {item.children!.map(child => renderMenuItem(child, level + 1))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )
    }

    // Leaf node - either link or button
    if (item.href) {
      // For Next.js apps, onClick handler should handle navigation
      return (
        <Button
          key={item.id}
          variant="ghost-nav"
          size="default"
          onClick={() => {
            // Let the parent handle navigation
            item.onClick?.()
            config.onClose()
          }}
          leftIcon={item.icon}
          className={cn(
            "!w-full sm:!w-full rounded-lg transition-colors",
            level === 0 ? "pl-3" : "pl-6",
            item.isActive
              ? "bg-ods-accent text-ods-text-on-accent hover:bg-ods-accent/90"
              : "text-ods-text-primary hover:bg-ods-border"
          )}
        >
          {item.label}
          {item.badge !== undefined && (
            <span className="ml-auto">{item.badge}</span>
          )}
        </Button>
      )
    }

    return (
      <Button
        key={item.id}
        variant="ghost-nav"
        size="default"
        onClick={() => {
          item.onClick?.()
          config.onClose()
        }}
        leftIcon={item.icon}
        className={cn(
          "!w-full sm:!w-full rounded-lg transition-colors",
          level === 0 ? "pl-3" : "pl-6",
          item.isActive
            ? "bg-ods-accent text-ods-text-on-accent hover:bg-ods-accent/90"
            : "text-ods-text-primary hover:bg-ods-border"
        )}
      >
        {item.label}
        {item.badge !== undefined && (
          <span className="ml-auto">{item.badge}</span>
        )}
      </Button>
    )
  }

  if (!mounted) {
    return null
  }

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {config.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: 0.3, 
              ease: [0.4, 0, 0.2, 1]
            }}
            className="fixed inset-0 bg-black/50 z-[40]"
            onClick={() => config.onClose()}
          />
        )}
      </AnimatePresence>

      {/* Sliding Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          x: config.isOpen ? 0 : (config.position === 'right' ? "100%" : "-100%")
        }}
        transition={{ 
          type: "spring", 
          damping: 25, 
          stiffness: 300,
          mass: 0.8,
          restDelta: 0.01,
          velocity: config.isOpen ? 5 : -5
        }}
        className={cn(
          "fixed top-0 bottom-0 z-[45] w-64 bg-ods-card border-ods-border flex flex-col shadow-xl",
          config.position === 'right' ? "right-0 border-l" : "left-0 border-r",
          config.className
        )}
      >
        {/* Header spacer - dynamic height */}
        <div className="flex-shrink-0" style={{ height: `${headerHeight}px` }} />
        
        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {config.items.map(item => renderMenuItem(item))}
        </nav>

        {/* Footer */}
        {config.footer && (
          <div className="p-4 border-t border-ods-border">
            {config.footer}
          </div>
        )}
      </motion.aside>

    </>
  )
}