"use client"

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { cn } from '../../utils'

export interface StickyNavSection {
  id: string
  label: string
}

interface StickySectionNavProps {
  sections: StickyNavSection[]
  activeSection: string
  onSectionClick: (sectionId: string) => void
  className?: string
  ribbonPosition?: 'left' | 'right'
  ribbonColor?: string
}

/**
 * Reusable sticky navigation component for section-based navigation
 * Used in vendor detail pages, knowledge base, documentation, etc.
 */
export function StickySectionNav({
  sections,
  activeSection,
  onSectionClick,
  className,
  ribbonPosition = 'left',
  ribbonColor = '#FFC008'
}: StickySectionNavProps) {
  const navHeight = sections.length * 40 // 40px per item (h-10)

  return (
    <nav className={cn("bg-ods-bg relative", className)}>
      {/* Background gray vertical line for all nav items */}
      <div
        className="absolute bg-ods-border"
        style={{
          width: '1px',
          height: `${navHeight}px`,
          [ribbonPosition === 'left' ? 'left' : 'right']: '-2px',
          top: '0px'
        }}
      />

      {sections.map((section) => (
        <div
          key={section.id}
          className="relative w-full h-10 transition-all duration-200 flex items-stretch"
        >
          {/* Yellow ribbon for active state */}
          {activeSection === section.id && (
            <div
              className="absolute z-10 transition-all duration-200"
              style={{
                backgroundColor: ribbonColor,
                width: '4px',
                height: '24px',
                [ribbonPosition === 'left' ? 'left' : 'right']: '-2px',
                top: '8px',
                borderRadius: '2px'
              }}
            />
          )}

          {/* Navigation button */}
          <button
            onClick={() => onSectionClick(section.id)}
            className="flex-1 flex items-stretch gap-2 px-3 py-2 cursor-pointer relative"
          >
            <span className={cn(
              "flex items-center font-['DM_Sans'] text-[14px] font-medium tracking-[-0.02em] leading-[1.43em] transition-all duration-200",
              activeSection === section.id
                ? "text-ods-text-primary"
                : "text-ods-text-secondary hover:text-ods-text-primary"
            )}>
              {section.label}
            </span>
          </button>
        </div>
      ))}
    </nav>
  )
}

/**
 * SIMPLEST POSSIBLE IMPLEMENTATION - Just make it work
 */
export function useSectionNavigation(
  sections: { id: string; ref: React.RefObject<HTMLElement> }[],
  options?: {
    offset?: number
  }
) {
  const [activeSection, setActiveSection] = useState(sections[0]?.id || '')
  const isScrollingFromClick = useRef(false)
  const { offset = 100 } = options || {}

  // Handle click - just scroll to the element
  const handleSectionClick = useCallback((sectionId: string) => {
    const targetElement = document.getElementById(sectionId)
    if (!targetElement) return

    // Prevent scroll spy while we're scrolling
    isScrollingFromClick.current = true
    setActiveSection(sectionId)

    // Scroll to element
    const top = targetElement.offsetTop - offset
    window.scrollTo({ top, behavior: 'smooth' })

    // Allow scroll spy again after scroll completes
    setTimeout(() => {
      isScrollingFromClick.current = false
    }, 500)
  }, [offset])

  // Make sure elements have IDs
  useEffect(() => {
    sections.forEach(section => {
      if (section.ref.current && !section.ref.current.id) {
        section.ref.current.id = section.id
      }
    })
  }, [sections])

  // Simple scroll spy
  useEffect(() => {
    const handleScroll = () => {
      if (isScrollingFromClick.current) return

      const scrollPosition = window.scrollY + offset + 50

      // Find which section we're in
      let currentSection = sections[0]?.id || ''
      
      for (let i = sections.length - 1; i >= 0; i--) {
        const element = document.getElementById(sections[i].id)
        if (element && scrollPosition >= element.offsetTop) {
          currentSection = sections[i].id
          break
        }
      }

      setActiveSection(currentSection)
    }

    // Throttle the scroll handler
    let scrollTimer: NodeJS.Timeout
    const throttledScroll = () => {
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(handleScroll, 100)
    }

    window.addEventListener('scroll', throttledScroll)
    handleScroll() // Check initial position

    return () => {
      window.removeEventListener('scroll', throttledScroll)
      clearTimeout(scrollTimer)
    }
  }, [sections, offset])

  return {
    activeSection,
    handleSectionClick
  }
}