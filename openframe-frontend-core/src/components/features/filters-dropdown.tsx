"use client"

import * as React from "react"
import { Button } from "../ui"
import { useEffect, useRef, useState } from "react"
import { cn } from "../../utils/cn"

// Types for filter configuration
export interface FilterOption {
  id: string
  label: string
  value: string | number | boolean
  count?: number
  type?: 'option' | 'separator'
}

export interface FilterSection {
  id: string
  title: string
  type: "checkbox" | "radio" | "select"
  options: FilterOption[]
  allowSelectAll?: boolean
  defaultSelected?: string[]
}

export interface FiltersDropdownProps {
  triggerElement?: React.ReactNode // Custom trigger element
  triggerLabel?: string // Label for default trigger button
  sections: FilterSection[]
  onApply: (filters: Record<string, string[]>) => void
  onReset?: () => void
  className?: string
  dropdownClassName?: string
  /**
   * Currently applied filters to preserve state when reopening.
   * Pass the same filters that were applied via onApply callback.
   *
   * @example
   * ```tsx
   * const { appliedFilters, handleApply } = useFiltersDropdown(sections)
   *
   * <FiltersDropdown
   *   sections={sections}
   *   onApply={handleApply}
   *   currentFilters={appliedFilters}
   *   triggerLabel="STATUS"
   * />
   * ```
   */
  currentFilters?: Record<string, string[]>
  placement?: "bottom-start" | "bottom-end" | "bottom"
  /**
   * Enable responsive mobile behavior (full width on mobile)
   * @default true
   */
  responsive?: boolean
}

// Custom checkbox component
const FilterCheckbox: React.FC<{
  checked: boolean
  disabled?: boolean
  className?: string
}> = ({ checked, disabled = false, className }) => {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      className={cn(
        "relative h-6 w-6 rounded-[6px] transition-all duration-150 shrink-0",
        checked ? "bg-ods-accent" : "bg-ods-bg-secondary",
        !checked && "border-2 border-ods-border",
        disabled && "opacity-50",
        className
      )}
    >
      {checked && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            width="14"
            height="10"
            viewBox="0 0 14 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-ods-text-on-accent"
          >
            <path
              d="M1 5L5 9L13 1"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  )
}

// Animation timings (ms). Must stay in sync with the `duration-200` Tailwind
// class on the dropdown panel below.
const ANIMATION_MS = 200

export const FiltersDropdown: React.FC<FiltersDropdownProps> = ({
  triggerElement,
  triggerLabel = "Filters",
  sections,
  onApply,
  onReset,
  className,
  dropdownClassName,
  currentFilters,
  placement = "bottom-start",
  responsive = true
}) => {
  const [isOpen, setIsOpen] = useState(false)
  // `shouldRender` controls mount/unmount.
  // `isVisible` controls the open/closed *visual* state and drives the CSS transition.
  // Splitting them lets us mount in the closed visual state, then flip to open on
  // the next frame so the browser actually transitions (instead of teleporting).
  const [shouldRender, setShouldRender] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [actualPlacement, setActualPlacement] = useState(placement)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement | HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Drive mount/unmount and visual state from `isOpen`.
  //
  // Open  : mount with closed styles → wait two frames, flip to visible → CSS transition runs.
  // Close : flip to invisible → CSS transition runs → unmount after duration.
  //
  // Because we use CSS transitions (not @keyframes), interrupting mid-animation
  // smoothly continues from the current computed value — no flicker.
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      // Double rAF: the first frame guarantees the element is mounted and the
      // closed styles have been painted; the second flips to the open state so
      // the browser sees a transitionable property change. A single rAF can
      // sometimes fire in the same frame as mount, suppressing the transition.
      let id2 = 0
      const id1 = requestAnimationFrame(() => {
        id2 = requestAnimationFrame(() => setIsVisible(true))
      })
      return () => {
        cancelAnimationFrame(id1)
        cancelAnimationFrame(id2)
      }
    }
    setIsVisible(false)
    const t = setTimeout(() => setShouldRender(false), ANIMATION_MS)
    return () => clearTimeout(t)
  }, [isOpen])

  // Check if mobile on mount and resize
  useEffect(() => {
    if (!responsive) {
      setIsMobile(false)
      return
    }

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640) // sm breakpoint
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [responsive])

  useEffect(() => {
    if (!isOpen || isMobile || !triggerRef.current) return

    const calculateOptimalPlacement = () => {
      const trigger = triggerRef.current
      if (!trigger) return

      const triggerRect = trigger.getBoundingClientRect()
      const dropdownWidth = 320 // Fixed width from the dropdown
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      const spaceRight = viewportWidth - triggerRect.right
      const spaceLeft = triggerRect.left
      const spaceBelow = viewportHeight - triggerRect.bottom

      let optimalPlacement = placement

      if (placement === "bottom-start" && spaceRight < dropdownWidth && spaceLeft >= dropdownWidth) {
        optimalPlacement = "bottom-end"
      } else if (placement === "bottom-end" && spaceLeft < dropdownWidth && spaceRight >= dropdownWidth) {
        optimalPlacement = "bottom-start"
      } else if (placement === "bottom" && (spaceLeft < dropdownWidth / 2 || spaceRight < dropdownWidth / 2)) {
        optimalPlacement = spaceLeft > spaceRight ? "bottom-end" : "bottom-start"
      }

      setActualPlacement(optimalPlacement)
    }

    calculateOptimalPlacement()
    window.addEventListener('resize', calculateOptimalPlacement)

    return () => window.removeEventListener('resize', calculateOptimalPlacement)
  }, [isOpen, isMobile, placement])

  // Initialize state with current filters or defaults
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>(() => {
    if (currentFilters) {
      return { ...currentFilters }
    }
    const initial: Record<string, string[]> = {}
    sections.forEach(section => {
      initial[section.id] = section.defaultSelected || []
    })
    return initial
  })

  // Sync with external changes to currentFilters
  const currentFiltersStr = currentFilters ? JSON.stringify(currentFilters) : ''
  useEffect(() => {
    if (currentFilters) {
      setSelectedFilters({ ...currentFilters })
    }
  }, [currentFiltersStr])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside the entire component container
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setActualPlacement(placement)
      }
    }

    if (isOpen) {
      // Use a small delay to avoid closing immediately after opening
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 0)

      return () => {
        clearTimeout(timer)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen, placement])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setActualPlacement(placement)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, placement])

  const handleToggleOption = (sectionId: string, optionId: string, sectionType: string) => {
    setSelectedFilters(prev => {
      const current = prev[sectionId] || []

      if (sectionType === "radio") {
        return {
          ...prev,
          [sectionId]: [optionId]
        }
      } else {
        if (current.includes(optionId)) {
          return {
            ...prev,
            [sectionId]: current.filter(id => id !== optionId)
          }
        } else {
          return {
            ...prev,
            [sectionId]: [...current, optionId]
          }
        }
      }
    })
  }

  const handleSelectAll = (sectionId: string, section: FilterSection) => {
    const allOptionIds = section.options.map(opt => opt.id)
    const currentSelection = selectedFilters[sectionId] || []
    const isAllSelected = allOptionIds.every(id => currentSelection.includes(id))

    setSelectedFilters(prev => ({
      ...prev,
      [sectionId]: isAllSelected ? [] : allOptionIds
    }))
  }

  const handleReset = () => {
    const defaults: Record<string, string[]> = {}
    sections.forEach(section => {
      defaults[section.id] = section.defaultSelected || []
    })
    setSelectedFilters(defaults)
    onReset?.()
    setIsOpen(false)
  }

  const handleApply = () => {
    onApply(selectedFilters)
    setIsOpen(false)
    setActualPlacement(placement)
  }

  const getActiveFiltersCount = () => {
    return Object.values(selectedFilters).reduce((acc: number, curr: string[]) => acc + curr.length, 0)
  }

  // Dropdown positioning classes based on placement and mobile state
  const getDropdownPositionClasses = () => {
    if (isMobile) {
      // On mobile, center horizontally with left offset for minimized sidebar
      // Vertically position right under the trigger button
      return "top-full mt-2"
    }

    // Desktop positioning based on placement prop
    const desktopClasses = {
      "bottom-start": "top-full left-0 mt-2",
      "bottom-end": "top-full right-0 mt-2",
      "bottom": "top-full left-1/2 -translate-x-1/2 mt-2"
    }

    return desktopClasses[actualPlacement]
  }

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      {/* Trigger */}
      {triggerElement ? (
        <div ref={triggerRef as React.RefObject<HTMLDivElement>} onClick={() => setIsOpen(!isOpen)}>
          {triggerElement}
        </div>
      ) : (
        <button
          ref={triggerRef as React.RefObject<HTMLButtonElement>}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "text-h5 transition-colors flex items-center gap-1.5",
            getActiveFiltersCount() > 0
              ? "text-ods-accent hover:text-ods-accent/80"
              : "text-ods-text-secondary hover:text-ods-text-primary",
          )}
        >
          {triggerLabel}
          {getActiveFiltersCount() > 0 && (
            <span className="size-1.5 rounded-full bg-ods-accent" />
          )}
        </button>
      )}

      {/* Dropdown Panel — kept mounted briefly on close to play exit transition. */}
      {shouldRender && (
        <div
          ref={dropdownRef}
          className={cn(
            "z-50 origin-top",
            // CSS transitions (not @keyframes) so mid-animation interruption
            // interpolates smoothly from the current computed value.
            "transition-[opacity,transform] duration-200 ease-out",
            "will-change-[opacity,transform]",
            isVisible
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 -translate-y-2 pointer-events-none",
            isMobile
              ? "fixed left-4 right-4 max-w-[320px] mx-auto"
              : "absolute w-[320px]",
            getDropdownPositionClasses(),
            dropdownClassName
          )}
          style={isMobile ? {
            top: triggerRef.current ? triggerRef.current.getBoundingClientRect().bottom + window.scrollY + 8 : 0
          } : undefined}
        >
          <div className="bg-ods-bg rounded-md border border-ods-border p-4 shadow-xl flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto max-h-[250px]">
            {sections.map((section, sectionIndex) => {
              const sectionSelection = selectedFilters[section.id] || []
              const allSelected = section.options.every(opt =>
                sectionSelection.includes(opt.id)
              )

              return (
                <div key={section.id} className={cn(
                  "space-y-2",
                  sectionIndex > 0 && "mt-4"
                )}>
                  {/* Section Header — sticky so title + Select All stay visible while options scroll. */}
                  <div className="sticky top-0 z-10 bg-ods-bg flex items-center justify-between pb-2">
                    <h3 className="text-h5 text-ods-text-secondary">
                      {section.title}
                    </h3>
                    {section.allowSelectAll && section.type === "checkbox" && (
                      <button
                        onClick={() => handleSelectAll(section.id, section)}
                        className="text-h6 text-ods-text-secondary hover:text-ods-text-primary underline transition-colors"
                      >
                        {allSelected ? "Deselect All" : "Select All"}
                      </button>
                    )}
                  </div>

                  {/* Options Container */}
                  <div className="bg-ods-bg rounded-md border border-ods-border overflow-hidden">
                    {section.options.map((option, index) => {
                      // Handle separator type
                      if (option.type === 'separator') {
                        return (
                          <div
                            key={`${section.id}-separator-${index}`}
                            className="border-t border-ods-border my-1"
                          />
                        )
                      }

                      const isSelected = sectionSelection.includes(option.id)
                      const isLast = index === section.options.length - 1

                      return (
                        <button
                          type="button"
                          key={`${section.id}-${option.id}-${index}`}
                          onClick={() => handleToggleOption(section.id, option.id, section.type)}
                          className={cn(
                            "flex items-center gap-[var(--spacing-system-s)] p-[var(--spacing-system-s)] w-full text-left",
                            isSelected ? "bg-ods-bg-secondary" : "bg-ods-bg",
                            !isLast && "border-b border-ods-border",
                            "hover:bg-ods-bg-hover transition-colors"
                          )}
                        >
                          <FilterCheckbox checked={isSelected} />
                          <span className="flex-1 min-w-0 text-h4 text-ods-text-primary truncate">
                            {option.label}
                          </span>
                          {option.count !== undefined && (
                            <span className="shrink-0 text-h6 text-ods-text-secondary">
                              {option.count.toLocaleString()}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            </div>
            {/* Action Buttons */}
            <div className="flex gap-3 mt-4 shrink-0">
              <Button
                variant="card"
                onClick={handleReset}
                size="default"
                className="md:w-full!"
              >
                Reset
              </Button>
              <Button
                variant="primary"
                onClick={handleApply}
                size="default"
                className="md:w-full!"
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Export convenience hook for managing filter state
export const useFiltersDropdown = (initialSections: FilterSection[]) => {
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {}
    initialSections.forEach(section => {
      if (section.defaultSelected) {
        initial[section.id] = section.defaultSelected
      }
    })
    return initial
  })

  const handleApply = (filters: Record<string, string[]>) => {
    setAppliedFilters(filters)
  }

  const handleReset = () => {
    const defaults: Record<string, string[]> = {}
    initialSections.forEach(section => {
      defaults[section.id] = section.defaultSelected || []
    })
    setAppliedFilters(defaults)
  }

  const getActiveFiltersCount = () => {
    return Object.values(appliedFilters).reduce((acc: number, curr: string[]) => acc + curr.length, 0)
  }

  return {
    appliedFilters,
    handleApply,
    handleReset,
    getActiveFiltersCount
  }
}
