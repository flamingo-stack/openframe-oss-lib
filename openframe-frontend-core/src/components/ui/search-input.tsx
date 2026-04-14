"use client"

import * as PopoverPrimitive from "@radix-ui/react-popover"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"
import * as React from "react"
import { cn } from "../../utils/cn"
import { useDebounce } from "../../hooks/ui/use-debounce"
import { useAutoLimitTags } from "../../hooks/ui/use-auto-limit-tags"
import { SearchIcon } from "../icons-v2-generated"
import { XmarkCircleIcon } from "../icons-v2-generated/signs-and-symbols/xmark-circle-icon"
import { Tag } from "./tag"
import { HiddenTagsPopup } from "./hidden-tags-popup"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string
  title: string
  description?: string
  path?: string
  type?: string
  icon?: React.ReactNode
  metadata?: Record<string, unknown>
}

export interface FilterChipData {
  id: string
  label: string
  variant?: "selected" | "category" | "subcategory" | "tag"
}

export interface SearchInputProps {
  /** Placeholder text shown in the input */
  placeholder?: string
  /** Controlled value */
  value?: string
  /** Default value for uncontrolled mode */
  defaultValue?: string
  /** Called when input value changes (raw, not debounced) */
  onChange?: (value: string) => void
  /** Called when user presses Enter */
  onSubmit?: (value: string) => void
  /** Search results to display in the dropdown */
  results?: SearchResult[]
  /** Whether results are loading */
  isLoading?: boolean
  /** Called when a result row is selected */
  onResultSelect?: (result: SearchResult) => void
  /** Debounce delay in ms. 0 disables debounce. Default 300 */
  debounceMs?: number
  /** Custom renderer for a single result row */
  renderResult?: (result: SearchResult, isHighlighted: boolean) => React.ReactNode
  /** Group results by a key derived from each result */
  groupBy?: (result: SearchResult) => string
  /** Text shown when query meets minQueryLength but no results */
  emptyResultsText?: string
  /** Force-control dropdown visibility. Default: auto */
  showDropdown?: boolean
  /** Filter chips rendered inline before the input */
  filterChips?: FilterChipData[]
  /** Called when a filter chip is removed */
  onFilterRemove?: (id: string) => void
  /** Element rendered before the input. Default: SearchIcon */
  startAdornment?: React.ReactNode
  /** Element rendered after the input */
  endAdornment?: React.ReactNode
  /** Extra class names for the outer container */
  className?: string
  /** Extra class names for the dropdown */
  dropdownClassName?: string
  /** Minimum characters before showing results. Default 2 */
  minQueryLength?: number
  /** Maximum visible filter chips. "auto" measures available width. Default "auto" */
  limitTags?: number | "auto"
  /** Custom render for the "+N" overflow text */
  getLimitTagsText?: (more: number) => React.ReactNode
}

// ---------------------------------------------------------------------------
// Shared styles (consistent with Autocomplete / Input)
// ---------------------------------------------------------------------------

const containerStyles = cn(
  // Layout & spacing — matches lib Input component
  "flex items-center gap-2 rounded-[6px] border px-3 h-11 md:h-12 cursor-text",
  "has-[:focus-visible]:outline-none",
  "group",
  "transition-colors duration-200",
  // Theme palette — matches lib Input component
  "bg-ods-card border-ods-border has-[:focus]:border-ods-accent"
)

const innerInputStyles = cn(
  "flex-1 min-w-[60px] bg-transparent border-none outline-none",
  "text-ods-text-primary placeholder:text-ods-text-secondary",
  "disabled:cursor-not-allowed",
  "touch-manipulation"
)

// ---------------------------------------------------------------------------
// Helper: chip variant → Tag variant mapping
// ---------------------------------------------------------------------------

function chipVariantToTagVariant(variant?: FilterChipData["variant"]): "primary" | "outline" {
  switch (variant) {
    case "selected":
      return "primary"
    case "category":
    case "subcategory":
    case "tag":
    default:
      return "outline"
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchInput({
  placeholder = "Search...",
  value,
  defaultValue = "",
  onChange,
  onSubmit,
  results = [],
  isLoading = false,
  onResultSelect,
  debounceMs = 300,
  renderResult,
  groupBy,
  emptyResultsText = "No results found",
  showDropdown: showDropdownProp,
  filterChips = [],
  onFilterRemove,
  startAdornment,
  endAdornment,
  className,
  dropdownClassName,
  minQueryLength = 2,
  limitTags = "auto",
  getLimitTagsText = (more: number) => `+${more}`,
}: SearchInputProps) {
  // ---- Controlled / uncontrolled ----
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const currentValue = onChange ? (value ?? "") : internalValue

  // ---- Debounce ----
  const debouncedValue = useDebounce(currentValue, debounceMs)

  // ---- Popover state ----
  const [isOpen, setIsOpen] = React.useState(false)
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1)

  const containerRef = React.useRef<HTMLDivElement>(null)

  // ---- Auto-limit tags ----
  const currentPlaceholder = filterChips.length > 0 ? "Add filter..." : placeholder

  const {
    visibleCount: rawVisibleCount, middleRef, measureRef, textMeasureRef, badgeRef, inputRef,
  } = useAutoLimitTags({
    count: filterChips.length,
    limitTags,
    // When chips exist, pass empty placeholder so the hook only reserves input minWidth,
    // not the full placeholder text width — gives more room for chips on narrow screens
    placeholder: filterChips.length > 0 ? "" : placeholder,
  })

  // Always show at least 1 chip when chips exist (industry standard: Gmail, MUI, Ant Design)
  const visibleCount = filterChips.length > 0 ? Math.max(1, rawVisibleCount) : rawVisibleCount

  // ---- Hidden tags popup ----
  const hiddenTagsRef = React.useRef<HTMLDivElement>(null)
  const hiddenTagsPopupRef = React.useRef<HTMLDivElement>(null)
  const [showHiddenTags, setShowHiddenTags] = React.useState(false)

  React.useEffect(() => {
    if (!showHiddenTags) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (!hiddenTagsRef.current?.contains(target) && !hiddenTagsPopupRef.current?.contains(target)) {
        setShowHiddenTags(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showHiddenTags])

  // ---- Derived chip slicing ----
  const hiddenCount = filterChips.length - visibleCount
  const visibleChips = filterChips.slice(0, visibleCount)
  const hiddenChips = filterChips.slice(visibleCount)

  // ---- Derive flat list (possibly grouped) ----
  const { flatResults, groups } = React.useMemo(() => {
    if (!groupBy) return { flatResults: results, groups: null }

    const grouped = new Map<string, SearchResult[]>()
    for (const r of results) {
      const key = groupBy(r)
      const arr = grouped.get(key)
      if (arr) {
        arr.push(r)
      } else {
        grouped.set(key, [r])
      }
    }
    return { flatResults: results, groups: grouped }
  }, [results, groupBy])

  // ---- Auto-show logic ----
  const meetsMinQuery = debouncedValue.length >= minQueryLength
  const autoShow = meetsMinQuery
  const dropdownVisible = showDropdownProp ?? (isOpen && autoShow)

  // ---- Reset highlight when results change ----
  React.useEffect(() => {
    setHighlightedIndex(-1)
  }, [flatResults.length])

  // ---- Handlers ----
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value
    if (onChange) {
      onChange(newVal)
    } else {
      setInternalValue(newVal)
    }
    if (!isOpen) setIsOpen(true)
    setHighlightedIndex(-1)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (onChange) {
      onChange("")
    } else {
      setInternalValue("")
    }
    inputRef.current?.focus()
  }

  const handleResultClick = (result: SearchResult) => {
    onResultSelect?.(result)
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        if (!isOpen) setIsOpen(true)
        setHighlightedIndex((prev) =>
          prev < flatResults.length - 1 ? prev + 1 : 0
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : flatResults.length - 1
        )
        break
      case "Enter":
        e.preventDefault()
        if (highlightedIndex >= 0 && flatResults[highlightedIndex]) {
          handleResultClick(flatResults[highlightedIndex])
        } else {
          onSubmit?.(currentValue)
        }
        break
      case "Escape":
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
      case "Backspace":
        if (!currentValue && filterChips.length > 0 && onFilterRemove) {
          onFilterRemove(filterChips[filterChips.length - 1].id)
        }
        break
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
  }

  // ---- Default result renderer ----
  const defaultRenderResult = (result: SearchResult, isHighlighted: boolean) => (
    <div className="flex items-center gap-3 w-full min-w-0">
      {result.icon && (
        <span className="flex-shrink-0 text-ods-text-secondary [&_svg]:size-4">
          {result.icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className={cn(
          "text-sm font-medium leading-5 truncate",
          isHighlighted ? "text-ods-accent" : "text-ods-text-primary"
        )}>
          {result.title}
        </div>
        {result.description && (
          <div className="text-xs leading-4 text-ods-text-secondary truncate mt-0.5">
            {result.description}
          </div>
        )}
      </div>
      {result.type && (
        <span className="flex-shrink-0 text-[11px] font-medium text-ods-text-muted uppercase tracking-wider">
          {result.type}
        </span>
      )}
    </div>
  )

  // ---- Render a result row ----
  const renderRow = (result: SearchResult, index: number) => {
    const isHighlighted = index === highlightedIndex
    return (
      <div
        key={result.id}
        role="option"
        aria-selected={isHighlighted}
        className={cn(
          "flex items-center min-h-10 px-3 cursor-pointer transition-colors border-b border-ods-border last:border-b-0",
          isHighlighted && "bg-ods-bg-hover",
          !isHighlighted && "hover:bg-ods-bg-hover"
        )}
        onClick={() => handleResultClick(result)}
        onMouseEnter={() => setHighlightedIndex(index)}
      >
        {renderResult ? renderResult(result, isHighlighted) : defaultRenderResult(result, isHighlighted)}
      </div>
    )
  }

  // ---- Dropdown content ----
  const renderDropdownContent = () => {
    if (isLoading) {
      return (
        <div className="px-4 py-3 text-ods-text-secondary text-[14px]">
          Loading...
        </div>
      )
    }

    if (flatResults.length === 0) {
      return (
        <div className="px-4 py-3 text-ods-text-secondary text-[14px]">
          {emptyResultsText}
        </div>
      )
    }

    if (groups) {
      let globalIndex = 0
      return Array.from(groups.entries()).map(([groupLabel, groupResults]) => (
        <div key={groupLabel}>
          <div className="px-4 py-2 text-[12px] font-semibold text-ods-text-secondary uppercase tracking-wide bg-ods-bg">
            {groupLabel}
          </div>
          {groupResults.map((result) => {
            const idx = globalIndex++
            return renderRow(result, idx)
          })}
        </div>
      ))
    }

    return flatResults.map((result, index) => renderRow(result, index))
  }

  // ---- Determine if we have a value worth clearing ----
  const hasValue = currentValue.length > 0

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <PopoverPrimitive.Root open={dropdownVisible} onOpenChange={handleOpenChange} modal={false}>
        <PopoverPrimitive.Anchor asChild>
          <div
            className={cn(
              containerStyles,
              "hover:bg-ods-bg-hover hover:border-ods-border-hover active:bg-ods-bg-active active:border-ods-border-active",
              dropdownVisible && "!border-ods-accent"
            )}
            onClick={() => {
              inputRef.current?.focus()
              setIsOpen(true)
            }}
          >
            {/* Start Adornment — pinned left, shrink-0 */}
            <span className="flex-shrink-0 text-ods-text-secondary transition-colors duration-200 group-has-[:focus]:text-ods-accent [&_svg]:size-4 md:[&_svg]:size-6">
              {startAdornment !== undefined ? startAdornment : <SearchIcon />}
            </span>

            {/* Middle zone: chips + input — overflow hidden, single line */}
            <div ref={middleRef} className="flex-1 flex items-center gap-2 min-w-0 overflow-hidden">
              {/* Visible filter chips */}
              {visibleChips.map((chip) => (
                <Tag
                  key={chip.id}
                  variant={chipVariantToTagVariant(chip.variant)}
                  label={chip.label}
                  labelClassName="truncate max-w-[120px]"
                  onClose={onFilterRemove ? () => onFilterRemove(chip.id) : undefined}
                />
              ))}

              {/* "+N" overflow badge */}
              {hiddenCount > 0 && (
                <div ref={hiddenTagsRef} className="shrink-0">
                  <button
                    ref={badgeRef}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowHiddenTags((prev) => !prev)
                    }}
                    className={cn(
                      "flex items-center h-8 px-2",
                      "bg-ods-card border border-ods-border rounded-[6px]",
                      "font-mono text-[14px] font-medium leading-5 text-ods-text-secondary uppercase tracking-[-0.28px]",
                      "hover:bg-ods-bg-hover transition-colors cursor-pointer",
                    )}
                    aria-label={`${hiddenCount} more selected filters`}
                  >
                    {getLimitTagsText(hiddenCount)}
                  </button>
                </div>
              )}

              {/* Input */}
              <input
                ref={inputRef}
                type="text"
                value={currentValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  setIsOpen(true)
                  setShowHiddenTags(false)
                }}
                placeholder={currentPlaceholder}
                className={innerInputStyles}
              />
            </div>

            {/* End adornment / Clear — pinned right, shrink-0 */}
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              {hasValue && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center justify-center hover:opacity-70 transition-opacity"
                  aria-label="Clear search"
                >
                  <XmarkCircleIcon className="text-ods-text-secondary" size={24} />
                </button>
              )}
              {endAdornment}
            </div>
          </div>
        </PopoverPrimitive.Anchor>

        <PopoverPrimitive.Content
          className={cn(
            "z-50 w-[var(--radix-popover-trigger-width)] mt-1",
            "bg-ods-card border border-ods-border rounded-[6px] overflow-hidden shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
            dropdownClassName
          )}
          sideOffset={4}
          align="start"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            inputRef.current?.focus()
          }}
          onInteractOutside={(e) => {
            if (containerRef.current?.contains(e.target as Node)) {
              e.preventDefault()
            }
          }}
        >
          <ScrollAreaPrimitive.Root className="overflow-hidden">
            <ScrollAreaPrimitive.Viewport className="max-h-[320px] w-full">
              <div role="listbox">
                {renderDropdownContent()}
              </div>
            </ScrollAreaPrimitive.Viewport>
            <ScrollAreaPrimitive.Scrollbar className="hidden" orientation="vertical">
              <ScrollAreaPrimitive.Thumb />
            </ScrollAreaPrimitive.Scrollbar>
          </ScrollAreaPrimitive.Root>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Root>

      {/* Hidden tags popup — outside overflow-hidden, positioned under badge */}
      {showHiddenTags && hiddenCount > 0 && (
        <HiddenTagsPopup
          ref={hiddenTagsPopupRef}
          items={hiddenChips.map(chip => ({ label: chip.label, value: chip.id }))}
          style={{
            left: badgeRef.current
              ? badgeRef.current.getBoundingClientRect().left -
                (containerRef.current?.getBoundingClientRect().left ?? 0)
              : 0,
          }}
          onRemove={(value) => {
            onFilterRemove?.(value as string)
            if (hiddenCount <= 1) setShowHiddenTags(false)
          }}
        />
      )}

      {/* Off-screen measurement: placeholder text width — fixed positioning avoids scroll contribution */}
      <span
        ref={textMeasureRef}
        aria-hidden="true"
        className="fixed -left-[9999px] top-0 pointer-events-none whitespace-nowrap text-ods-text-primary"
      >
        {currentPlaceholder}
      </span>

      {/* Off-screen measurement: all chip widths */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="fixed -left-[9999px] top-0 flex gap-2 pointer-events-none"
      >
        {filterChips.map((chip) => (
          <Tag
            key={`m-${chip.id}`}
            variant={chipVariantToTagVariant(chip.variant)}
            label={chip.label}
            labelClassName="truncate max-w-[120px]"
            onClose={() => {}}
          />
        ))}
      </div>
    </div>
  )
}

export default SearchInput
