"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { cn } from "../../utils/cn"

// Types for filter configuration
export interface FilterOption {
  id: string
  label: string
  value: string | number | boolean
  type?: 'option' | 'separator'  // Add type for separator support
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
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}> = ({ checked, onChange, disabled = false, className }) => {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[24px] w-[24px] rounded-[6px] transition-all duration-150 shrink-0",
        checked ? "bg-[#ffc008]" : "bg-[#212121]",
        !checked && "border-2 border-[#3a3a3a]",
        disabled && "opacity-50 cursor-not-allowed",
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
            className="text-[#212121]"
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
    </button>
  )
}

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
  const [isMobile, setIsMobile] = useState(false)
  const [actualPlacement, setActualPlacement] = useState(placement)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement | HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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
    if (onReset) {
      onReset()
    }
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
            "font-['Azeret_Mono'] font-medium text-xs uppercase tracking-[-0.24px]",
            "text-[#888888] hover:text-[#fafafa] transition-colors",
            "flex items-center gap-2"
          )}
        >
          {triggerLabel}
          {getActiveFiltersCount() > 0 && (
            <span className="bg-[#ffc008] text-[#212121] px-1.5 py-0.5 rounded text-[10px] font-bold">
              {getActiveFiltersCount()}
            </span>
          )}
        </button>
      )}

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={cn(
            "z-50",
            isMobile 
              ? "fixed w-[320px] left-1/2 -translate-x-1/2 ml-6" // Fixed positioning with center + sidebar offset
              : "absolute w-[320px]", // Fixed width on desktop
            getDropdownPositionClasses(),
            dropdownClassName
          )}
          style={isMobile ? {
            top: triggerRef.current ? triggerRef.current.getBoundingClientRect().bottom + window.scrollY + 8 : 0
          } : undefined}
        >
          <div className="bg-[#161616] rounded-[6px] border border-[#3a3a3a] p-4 shadow-xl">
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
                  {/* Section Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="font-['Azeret_Mono'] font-medium text-xs uppercase tracking-[-0.24px] text-[#888888]">
                      {section.title}
                    </h3>
                    {section.allowSelectAll && section.type === "checkbox" && (
                      <button
                        onClick={() => handleSelectAll(section.id, section)}
                        className="font-['DM_Sans'] font-medium text-[14px] text-[#888888] hover:text-[#fafafa] underline transition-colors"
                      >
                        {allSelected ? "Deselect All" : "Select All"}
                      </button>
                    )}
                  </div>

                  {/* Options Container */}
                  <div className="bg-[#161616] rounded-[6px] border border-[#3a3a3a] overflow-hidden">
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
                        <div
                          key={`${section.id}-${option.id}-${index}`}
                          className={cn(
                            "flex items-center gap-2 px-2 py-2",
                            isSelected ? "bg-[#212121]" : "bg-[#161616]",
                            !isLast && "border-b border-[#3a3a3a]",
                            "hover:bg-[#212121] transition-colors min-h-[40px]"
                          )}
                        >
                          <FilterCheckbox
                            checked={isSelected}
                            onChange={() => handleToggleOption(section.id, option.id, section.type)}
                          />
                          <button
                            onClick={() => handleToggleOption(section.id, option.id, section.type)}
                            className="flex-1 text-left"
                          >
                            <span className="font-['DM_Sans'] font-medium text-[14px] text-[#fafafa] leading-[20px]">
                              {option.label}
                            </span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Action Buttons */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleReset}
                className="flex-1 bg-[#212121] border border-[#3a3a3a] text-[#fafafa] font-['DM_Sans'] font-bold text-[14px] py-2 px-4 rounded-[6px] hover:bg-[#2a2a2a] transition-colors h-10"
              >
                Reset
              </button>
              <button
                onClick={handleApply}
                className="flex-1 bg-[#ffc008] text-[#212121] font-['DM_Sans'] font-bold text-[14px] py-2 px-4 rounded-[6px] hover:bg-[#e6ac07] transition-colors h-10"
              >
                Apply
              </button>
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