"use client"

import {
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react"

import { SearchIcon } from "../icons-v2-generated/interface/search-icon"
import { XmarkCircleIcon } from "../icons-v2-generated/signs-and-symbols/xmark-circle-icon"
import { cn } from "../../utils/cn"
import { useAutoLimitTags } from "../../hooks/ui/use-auto-limit-tags"
import { HiddenTagsPopup } from "./hidden-tags-popup"
import { Tag } from "./tag"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TagSearchOption<T = string> {
  label: string
  value: T
}

export interface TagSearchInputProps<T = string> {
  /** Active tags displayed inline */
  tags: TagSearchOption<T>[]
  /** Controlled search input value */
  searchValue: string
  /** Called when input text changes */
  onSearchChange: (value: string) => void
  /** Called when a single tag is removed */
  onTagRemove: (value: T) => void
  /** Called when the clear-all button is clicked (clears tags + input) */
  onClearAll?: () => void
  /** Placeholder when no tags are present */
  placeholder?: string
  /** Placeholder when tags exist */
  addMorePlaceholder?: string
  /** Whether the component is disabled */
  disabled?: boolean
  /** Extra class names for the outer wrapper */
  className?: string
  /** Show the clear-all (x) icon on the right. Default true */
  showClearAll?: boolean
  /** Called when Enter is pressed */
  onSubmit?: (value: string) => void
  /** Forward arbitrary key events */
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  /** Custom render for tag label */
  renderTag?: (option: TagSearchOption<T>) => ReactNode
  /** Custom render function for the "+N" overflow text */
  getLimitTagsText?: (more: number) => ReactNode
  /** Maximum number of visible tags. Set to "auto" for automatic calculation based on available width. Default "auto" */
  limitTags?: number | "auto"
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TagSearchInput<T = string>({
  tags,
  searchValue,
  onSearchChange,
  onTagRemove,
  onClearAll,
  placeholder = "Search...",
  addMorePlaceholder = "Add More...",
  disabled = false,
  className,
  showClearAll = true,
  onSubmit,
  onKeyDown,
  renderTag,
  getLimitTagsText = (more: number) => `+${more}`,
  limitTags = "auto",
}: TagSearchInputProps<T>) {
  const currentPlaceholder = tags.length === 0 ? placeholder : addMorePlaceholder

  const {
    visibleCount, middleRef, measureRef, textMeasureRef, badgeRef, inputRef,
  } = useAutoLimitTags({
    count: tags.length,
    limitTags,
    placeholder: currentPlaceholder,
  })

  const wrapperRef = useRef<HTMLDivElement>(null)
  const hiddenTagsRef = useRef<HTMLDivElement>(null)
  const hiddenTagsPopupRef = useRef<HTMLDivElement>(null)
  const [showHiddenTags, setShowHiddenTags] = useState(false)

  // ---- Close hidden tags popup on outside click ----
  useEffect(() => {
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

  // ---- Derived state ----
  const hiddenCount = tags.length - visibleCount
  const visibleTags = tags.slice(0, visibleCount)
  const hiddenTags = tags.slice(visibleCount)
  const hasValue = tags.length > 0 || searchValue.length > 0

  // ---- Event handlers ----
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onSubmit) {
      e.preventDefault()
      onSubmit(searchValue)
    }
    onKeyDown?.(e)
  }

  const handleClearAll = (e: ReactMouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onClearAll?.()
    inputRef.current?.focus()
  }

  return (
    <div ref={wrapperRef} className="relative">
      {/* ---- Visible container ---- */}
      <div
        className={cn(
          "flex items-center rounded-[6px] border h-11 md:h-12 cursor-text",
          "transition-colors duration-200",
          "bg-ods-card border-ods-border",
          "has-[:focus]:border-ods-accent",
          !disabled && "hover:bg-ods-bg-hover hover:border-ods-border-hover",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
        onClick={() => {
          if (!disabled) inputRef.current?.focus()
        }}
      >
        {/* Search icon — pinned left, responsive size */}
        <div className="shrink-0 flex items-center pl-3">
          <SearchIcon className="text-ods-text-secondary size-4 md:size-6" />
        </div>

        {/* Middle zone: tags + input — overflow hidden so tags never push clear btn */}
        <div ref={middleRef} className="flex-1 flex items-center gap-2 min-w-0 overflow-hidden px-2">
          {visibleTags.map((tag) => (
            <Tag
              key={String(tag.value)}
              variant="outline"
              label={renderTag ? renderTag(tag) : tag.label}
              labelClassName="truncate max-w-[120px]"
              onClose={!disabled ? () => onTagRemove(tag.value) : undefined}
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
              >
                {getLimitTagsText(hiddenCount)}
              </button>
            </div>
          )}

          {/* Search input */}
          <input
            ref={inputRef}
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentPlaceholder}
            disabled={disabled}
            className={cn(
              "flex-1 min-w-[60px] bg-transparent border-none outline-none",
              "text-[18px] font-medium leading-6",
              "text-ods-text-primary placeholder:text-ods-text-secondary",
              "disabled:cursor-not-allowed",
            )}
          />
        </div>

        {/* Clear all — pinned right */}
        {showClearAll && hasValue && !disabled && (
          <button
            type="button"
            onClick={handleClearAll}
            className="shrink-0 flex items-center justify-center pr-3 hover:opacity-70 transition-opacity cursor-pointer"
            aria-label="Clear all"
          >
            <XmarkCircleIcon className="text-ods-text-secondary size-4 md:size-6" />
          </button>
        )}
      </div>

      {/* ---- Hidden tags popup — outside overflow-hidden, positioned under badge ---- */}
      {showHiddenTags && hiddenCount > 0 && (
        <HiddenTagsPopup
          ref={hiddenTagsPopupRef}
          items={hiddenTags}
          disabled={disabled}
          style={{
            left: badgeRef.current
              ? badgeRef.current.getBoundingClientRect().left -
                (wrapperRef.current?.getBoundingClientRect().left ?? 0)
              : 0,
          }}
          onRemove={(value) => {
            onTagRemove(value as T)
            if (hiddenCount <= 1) setShowHiddenTags(false)
          }}
        />
      )}

      {/* ---- Off-screen measurement containers ---- */}
      <span
        ref={textMeasureRef}
        aria-hidden="true"
        className="absolute left-0 top-0 pointer-events-none invisible -z-10 whitespace-nowrap text-[18px] font-medium leading-6"
      >
        {currentPlaceholder}
      </span>

      <div
        ref={measureRef}
        aria-hidden="true"
        className="absolute left-0 top-0 flex gap-2 pointer-events-none invisible -z-10"
      >
        {tags.map((tag) => (
          <Tag
            key={`m-${String(tag.value)}`}
            variant="outline"
            label={renderTag ? renderTag(tag) : tag.label}
            labelClassName="truncate max-w-[120px]"
            onClose={() => {}}
          />
        ))}
      </div>
    </div>
  )
}
