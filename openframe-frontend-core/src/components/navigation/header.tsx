"use client"

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { cn } from '../../utils'
import { HeaderConfig, NavigationItem } from '../../types/navigation'
import { Button } from '../ui/button'
import { useState as useDropdownState, useRef as useDropdownRef, useEffect as useDropdownEffect } from 'react'

export interface HeaderProps {
  config: HeaderConfig
  platform?: string
}

// Re-export from types for convenience
export type { HeaderConfig } from '../../types/navigation'

export function Header({ config, platform }: HeaderProps) {
  const [show, setShow] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({})
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  
  // Handle click outside and escape key for custom dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target) return

      // Check if click is outside all dropdowns
      const isOutsideAllDropdowns = Object.keys(openDropdowns).every(id => {
        const dropdown = dropdownRefs.current[id]
        const trigger = triggerRefs.current[id]
        
        if (!dropdown || !trigger) return true
        
        return !dropdown.contains(target) && !trigger.contains(target)
      })

      if (isOutsideAllDropdowns) {
        setOpenDropdowns({})
      }
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenDropdowns({})
      }
    }

    // Only add listeners if any dropdown is open
    const hasOpenDropdowns = Object.values(openDropdowns).some(Boolean)
    if (hasOpenDropdowns) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscapeKey)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [openDropdowns])

  // Force close all dropdowns and cleanup on unmount
  useEffect(() => {
    return () => {
      // Close all dropdowns before unmounting to prevent focus errors
      setOpenDropdowns({})
      // Clear any stored refs
      dropdownRefs.current = {}
      triggerRefs.current = {}
    }
  }, [])
  
  useEffect(() => {
    // Only add scroll listener if autoHide is enabled
    if (!config.autoHide) {
      setShow(true) // Always show header when autoHide is disabled
      return
    }
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      setLastScrollY(prevScrollY => {
        // Determine if we should show or hide the header
        const shouldHide = currentScrollY > prevScrollY && currentScrollY > 50
        const shouldShow = currentScrollY < prevScrollY || currentScrollY <= 10
        
        if (shouldHide) {
          setShow(false)
        } else if (shouldShow) {
          setShow(true)
        }
        
        return currentScrollY
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [config.autoHide])


  const renderNavigationItem = (item: NavigationItem) => {
    // If custom element provided, use it
    if (item.element) {
      return <React.Fragment key={item.id}>{item.element}</React.Fragment>
    }

    // If it has children, render as custom dropdown
    if (item.children && item.children.length > 0) {
      const isOpen = openDropdowns[item.id] || false
      
      return (
        <div key={item.id} className="relative">
          <Button
            ref={(el) => { triggerRefs.current[item.id] = el }}
            variant="ghost"
            leftIcon={item.icon}
            rightIcon={item.badge}
            onClick={() => {
              setOpenDropdowns(prev => ({ 
                ...prev, 
                [item.id]: !prev[item.id] 
              }))
            }}
            className={cn(
              "h-10 px-3 py-2",
              "font-['DM_Sans'] font-bold text-[16px] leading-none tracking-[-0.32px]",
              "hover:bg-ods-bg-hover focus:bg-ods-bg-hover",
              "whitespace-nowrap",
              "text-ods-text-primary", // All items use primary text color
              item.isActive && 'bg-ods-bg-hover', // Active items get subtle gray background
              isOpen && 'bg-ods-bg-hover', // Open dropdowns get gray background
              item.className
            )}
          >
            {item.label}
          </Button>
          
          {isOpen && (
            <div
              ref={(el) => { dropdownRefs.current[item.id] = el }}
              className={cn(
                "absolute top-full left-0 mt-1",
                item.dropdownClassName ? "" : "bg-ods-card border border-ods-border",
                "rounded-lg shadow-xl z-[9999]",
                item.id === 'community' ? "min-w-[240px]" : "min-w-[220px]",
                item.dropdownClassName || ''
              )}
            >
              <div className="p-2">
                {item.children.map((child, index) => (
                  <Button 
                    key={child.id}
                    variant="ghost" 
                    size="sm" 
                    href={child.href} // Use href for navigation
                    leftIcon={child.icon} 
                    rightIcon={child.badge}
                    onClick={() => {
                      // Always close dropdown when any item is clicked
                      setOpenDropdowns(prev => ({ ...prev, [item.id]: false }))
                      // If there's a custom onClick, call it too
                      if (child.onClick) {
                        child.onClick()
                      }
                    }}
                    className={cn(
                      "flex justify-start w-full",
                      index < (item.children?.length ?? 0) - 1 && "mb-1",
                      "text-ods-text-primary", // All dropdown items use primary text color
                      child.isActive && 'bg-ods-bg-hover' // Active dropdown items get gray background
                    )}
                    {...(child.isExternal && { isExternal: true })}
                  >
                    {child.label}
                  </Button>
                ))}
              </div>
              {item.dropdownContent && (
                <>
                  {item.showDropdownDivider !== false && <div className="h-px my-2 mx-2 bg-ods-border" />}
                  <div className="px-2 pb-2">
                    {item.dropdownContent}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )
    }

    // Regular navigation item
    if (item.href || item.onClick) {
      return (
        <Button
          key={item.id}
          variant="ghost"
          href={item.href} // Use href for navigation
          onClick={item.onClick} // Only for non-navigation actions
          leftIcon={item.icon}
          rightIcon={item.badge}
          className={cn(
            "h-10 px-3 py-2",
            "font-['DM_Sans'] font-bold text-[16px] leading-none tracking-[-0.32px]",
            "hover:bg-ods-bg-hover focus:bg-ods-bg-hover",
            "whitespace-nowrap",
            "text-ods-text-primary", // All items use primary text color
            item.isActive && 'bg-ods-bg-hover', // Active items get subtle gray background
            item.className
          )}
          {...(item.isExternal && { isExternal: true })}
        >
          {item.label}
        </Button>
      )
    }

    // Button with onClick
    return (
      <Button
        key={item.id}
        variant="ghost"
        onClick={item.onClick}
        leftIcon={item.icon}
        rightIcon={item.badge}
        className={cn(
          "h-10 px-3 py-2",
          "font-['DM_Sans'] font-bold text-[16px] leading-none tracking-[-0.32px]",
          "hover:bg-ods-bg-hover focus:bg-ods-bg-hover",
          "whitespace-nowrap",
          "text-ods-text-primary", // All items use primary text color
          item.isActive && 'bg-ods-bg-hover', // Active items get gray background
          item.className
        )}
      >
        {item.label}
      </Button>
    )
  }
  
  
  return (
    <div 
      className={cn(
        "sticky top-0 z-[50] w-full transition-transform duration-300 ease-in-out"
      )}
      style={{
        transform: !show ? 'translateY(-100%)' : 'translateY(0)'
      }}
    >
      <header
        className={cn(
          "w-full flex items-center justify-between",
          "border-b border-ods-border backdrop-blur-sm",
          "px-6 py-3",
          // Background color (configurable via backgroundColor prop)
          config.backgroundColor || "bg-ods-card",
          config.className
        )}
        style={config.style}
      >
      {/* Left: Logo */}
      <div className="flex items-center justify-start flex-shrink-0">
        {config.actions?.left && (
          <div className="flex items-center">
            {config.actions.left}
          </div>
        )}
        
        <Link href={config.logo.href} className="transition-opacity duration-200 hover:opacity-80">
          {config.logo.element}
        </Link>
      </div>

      {/* Center: Navigation */}
      {config.navigation && config.navigation.items.length > 0 && (
        <nav 
          className={cn(
            "hidden md:flex items-center gap-2",
            config.navigation.position === 'center' && "absolute left-1/2 transform -translate-x-1/2",
            config.navigation.position === 'right' && "ml-auto mr-4"
          )}
          role="navigation" 
          aria-label="Main navigation"
        >
          {config.navigation.items.map(renderNavigationItem)}
        </nav>
      )}

      {/* Right: Actions */}
      <div className="flex items-center justify-end gap-4 flex-shrink-0">
        {/* Desktop Actions */}
        {config.actions?.right && (
          <div className="hidden md:flex items-center gap-4">
            {config.actions.right}
          </div>
        )}

        {/* Mobile Menu Toggle */}
        {config.mobile && config.mobile.enabled && (
          <Button
              variant="ghost"
              size="sm"
              className="flex md:hidden p-2 h-10 w-10 items-center justify-center"
              onClick={() => {
                config.mobile?.onToggle?.()
              }}
              aria-label={config.mobile?.isOpen ? "Close menu" : "Open menu"}
              centerIcon={config.mobile?.menuIcon || <span>☰</span>}
            >
            </Button>
        )}
      </div>
    </header>
    </div>
  )
}