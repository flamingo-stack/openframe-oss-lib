"use client"

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

// Simple tooltip context
const TooltipContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
}>({
  open: false,
  setOpen: () => {}
})

// TooltipProvider - provides context for tooltips
interface TooltipProviderProps {
  children: React.ReactNode
  delayDuration?: number
}

function TooltipProvider({ children }: TooltipProviderProps) {
  return <>{children}</>
}

// TooltipRoot - manages tooltip state
interface TooltipRootProps {
  children: React.ReactNode
  delayDuration?: number
}

function TooltipRoot({ children }: TooltipRootProps) {
  const [open, setOpen] = React.useState(false)
  
  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      {children}
    </TooltipContext.Provider>
  )
}

// TooltipTrigger - the element that triggers the tooltip
interface TooltipTriggerProps {
  children: React.ReactNode
  asChild?: boolean
  className?: string
}

function TooltipTrigger({ children, className }: TooltipTriggerProps) {
  const { setOpen } = React.useContext(TooltipContext)
  
  return (
    <div
      className={className}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
    </div>
  )
}

// TooltipContent - the content shown in the tooltip
interface TooltipContentProps {
  children: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  sideOffset?: number
  align?: "start" | "center" | "end"
  className?: string
}

function TooltipContent({ 
  children, 
  className = ""
}: TooltipContentProps) {
  const { open } = React.useContext(TooltipContext)
  
  if (!open) return null
  
  return (
    <div
      className={`absolute z-50 px-3 py-1.5 text-sm text-white bg-gray-900 rounded-md shadow-md ${className}`}
      role="tooltip"
    >
      {children}
    </div>
  )
}

// Main Tooltip component for simple usage
interface TooltipProps {
  content: string
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  className?: string
}

export function Tooltip({ 
  content, 
  children, 
  side = 'top', 
  align = 'center',
  className = '' 
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    }

    let top = 0
    let left = 0

    // Calculate position based on side
    switch (side) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - 8
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2)
        break
      case 'bottom':
        top = triggerRect.bottom + 8
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2)
        break
      case 'left':
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2)
        left = triggerRect.left - tooltipRect.width - 8
        break
      case 'right':
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2)
        left = triggerRect.right + 8
        break
    }

    // Adjust for alignment
    if (side === 'top' || side === 'bottom') {
      if (align === 'start') {
        left = triggerRect.left
      } else if (align === 'end') {
        left = triggerRect.right - tooltipRect.width
      }
    }

    // Keep tooltip within viewport
    if (left < 8) left = 8
    if (left + tooltipRect.width > viewport.width - 8) {
      left = viewport.width - tooltipRect.width - 8
    }
    if (top < 8) top = 8
    if (top + tooltipRect.height > viewport.height - 8) {
      top = viewport.height - tooltipRect.height - 8
    }

    setPosition({ top, left })
  }

  useEffect(() => {
    if (isVisible) {
      updatePosition()
      window.addEventListener('scroll', updatePosition)
      window.addEventListener('resize', updatePosition)
      
      return () => {
        window.removeEventListener('scroll', updatePosition)
        window.removeEventListener('resize', updatePosition)
      }
    }
  }, [isVisible, side, align])

  const handleMouseEnter = () => {
    setIsVisible(true)
  }

  const handleMouseLeave = () => {
    setIsVisible(false)
  }

  const getArrowClasses = () => {
    const baseClasses = "absolute w-0 h-0"
    
    switch (side) {
      case 'top':
        return `${baseClasses} top-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#2A2A2A]`
      case 'bottom':
        return `${baseClasses} bottom-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-b-4 border-transparent border-b-[#2A2A2A]`
      case 'left':
        return `${baseClasses} left-full top-1/2 transform -translate-y-1/2 border-t-4 border-b-4 border-l-4 border-transparent border-l-[#2A2A2A]`
      case 'right':
        return `${baseClasses} right-full top-1/2 transform -translate-y-1/2 border-t-4 border-b-4 border-r-4 border-transparent border-r-[#2A2A2A]`
    }
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block"
      >
        {children}
      </div>
      
      {isVisible && typeof window !== 'undefined' && createPortal(
        <div
          ref={tooltipRef}
          className={`fixed z-[9999] p-4 bg-[#2A2A2A] border border-ods-border rounded-lg shadow-lg pointer-events-none transition-opacity duration-200 ${className || 'max-w-sm'}`}
          style={{
            top: position.top,
            left: position.left,
          }}
        >
          <div className={getArrowClasses()}></div>
          <div className="font-['DM_Sans'] text-ods-text-primary whitespace-pre-wrap leading-relaxed space-y-1">
            {content.split('\n').map((line, index) => {
              // Check if line is a section header (ALL CAPS)
              const isTitle = line.includes('GitHub Score Calculation') || line.includes('OpenMSP Score Calculation');
              const isHeader = /^[A-Z][A-Z\s]+$/.test(line.trim()) && line.trim().length > 3;
              
                            if (isTitle) {
                return (
                  <div key={index} className="text-base font-bold text-ods-text-primary mb-2">
                    {line}
                  </div>
                );
              } else if (isHeader) {
                return (
                  <div key={index} className="text-sm font-semibold text-ods-text-primary mt-3 mb-1 first:mt-0">
                    {line}
                  </div>
                );
              } else if (line.trim() === '') {
                return <div key={index} className="h-1" />;
              } else {
                // Check if line contains yellow formatting
                if (line.includes('[YELLOW]') && line.includes('[/YELLOW]')) {
                  const parts = line.split('[YELLOW]');
                  const beforeYellow = parts[0];
                  const yellowParts = parts[1].split('[/YELLOW]');
                  const yellowText = yellowParts[0];
                  const afterYellow = yellowParts[1];
                  
                  return (
                    <div key={index} className="text-sm text-[#CCCCCC] leading-relaxed">
                      {beforeYellow}
                      <span className="text-ods-accent font-semibold">{yellowText}</span>
                      {afterYellow}
                    </div>
                  );
                } else {
                  return (
                    <div key={index} className="text-sm text-[#CCCCCC] leading-relaxed">
                      {line}
                    </div>
                  );
                }
              }
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

// Export all components
export { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent }
export default Tooltip 