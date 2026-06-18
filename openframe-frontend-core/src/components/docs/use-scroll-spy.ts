"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { scrollElementIntoView } from "../../utils/scroll-into-view"

interface ScrollSpySection {
  id: string
  title?: string
  level?: number
}

interface UseScrollSpyReturn {
  activeSection: string
  handleSectionClick: (sectionId: string) => void
}

/**
 * Shared scroll spy hook for tracking active section based on scroll position.
 * Used by DocViewer for sticky section navigation.
 */
export function useScrollSpy(sections: ScrollSpySection[] | undefined): UseScrollSpyReturn {
  const [activeSection, setActiveSection] = useState("")
  const isScrollingFromClick = useRef(false)

  const sectionIds = useMemo(
    () => sections?.map(s => s.id).join(',') ?? '',
    [sections]
  )
  const stableSections = useRef(sections)
  if (sectionIds !== (stableSections.current?.map(s => s.id).join(',') ?? '')) {
    stableSections.current = sections
  }

  const handleSectionClick = useCallback((sectionId: string) => {
    const targetElement = document.getElementById(sectionId)
    if (!targetElement) return

    isScrollingFromClick.current = true
    setActiveSection(sectionId)

    scrollElementIntoView(targetElement, { headerOffset: 100 })

    setTimeout(() => {
      isScrollingFromClick.current = false
    }, 800)
  }, [])

  useEffect(() => {
    const currentSections = stableSections.current
    if (!currentSections || currentSections.length === 0) return

    const handleScroll = () => {
      if (isScrollingFromClick.current) return

      const scrollPosition = window.scrollY + 150
      let currentSection = currentSections[0]?.id || ""

      for (let i = currentSections.length - 1; i >= 0; i--) {
        const element = document.getElementById(currentSections[i].id)
        if (element && scrollPosition >= element.offsetTop) {
          currentSection = currentSections[i].id
          break
        }
      }

      setActiveSection((prev) => (prev !== currentSection ? currentSection : prev))
    }

    let scrollTimer: ReturnType<typeof setTimeout>
    const throttledScroll = () => {
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(handleScroll, 100)
    }

    window.addEventListener("scroll", throttledScroll)
    handleScroll()

    return () => {
      window.removeEventListener("scroll", throttledScroll)
      clearTimeout(scrollTimer)
    }
  }, [sectionIds])

  return { activeSection, handleSectionClick }
}
