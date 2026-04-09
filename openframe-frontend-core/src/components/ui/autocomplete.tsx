"use client"

import {
  type ChangeEvent,
  type ForwardedRef,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"

import * as PopoverPrimitive from "@radix-ui/react-popover"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { CheckIcon } from "../icons-v2-generated/signs-and-symbols/check-icon"
import { XmarkCircleIcon } from "../icons-v2-generated/signs-and-symbols/xmark-circle-icon"
import { Chevron02DownIcon } from "../icons-v2-generated/arrows/chevron-02-down-icon"

import { cn } from "../../utils/cn"
import { useAutoLimitTags } from "../../hooks/ui/use-auto-limit-tags"
import { FieldWrapper } from "./field-wrapper"
import { HiddenTagsPopup } from "./hidden-tags-popup"
import { Tag } from "./tag"

export interface AutocompleteOption<T = string> {
  label: string
  value: T
}

export type AutocompleteInputChangeReason = 'input' | 'reset' | 'clear'

interface AutocompleteBaseProps<T = string> {
  /** Available options to select from */
  options: AutocompleteOption<T>[]
  /** Placeholder text */
  placeholder?: string
  /** Whether the component is disabled */
  disabled?: boolean
  /** Element displayed at the start of the input */
  startAdornment?: ReactNode
  /** Whether to show clear button */
  showClearAll?: boolean
  /** Custom className for the container */
  className?: string
  /** Custom className for the dropdown */
  dropdownClassName?: string
  /** When true, allows creating new options by typing */
  freeSolo?: boolean
  /** Label for the input */
  label?: string
  /** Error message displayed below the field */
  error?: string
  /** Custom filter function */
  filterOptions?: (options: AutocompleteOption<T>[], inputValue: string) => AutocompleteOption<T>[]
  /** Render custom option content */
  renderOption?: (option: AutocompleteOption<T>, isSelected: boolean) => ReactNode
  /** When true, shows validation error styling */
  invalid?: boolean
  /** No options text */
  noOptionsText?: string
  /** Controlled input value. When provided, the component won't manage input state internally. */
  inputValue?: string
  /** Callback when input value changes (typing, selection, clearing). Fires in both controlled and uncontrolled modes. */
  onInputChange?: (value: string, reason: AutocompleteInputChangeReason) => void
  /** Loading state */
  loading?: boolean
  /** Loading text */
  loadingText?: string
  /** When true, shows a clickable "+ Create" option when no results match the input */
  creatable?: boolean
  /** Callback fired after a new option is created via creatable. Use it to persist the new option server-side, etc. */
  onCreateOption?: (inputValue: string) => void
  /** When true, disables built-in client-side filtering (useful when options are filtered server-side via onInputChange) */
  disableClientFilter?: boolean
  /** Whether to show the chevron icon. Default true */
  showChevron?: boolean
  /** Whether to clear the input when the dropdown opens (single mode only). Default true */
  clearOnOpen?: boolean
}

export interface AutocompleteSingleProps<T = string> extends AutocompleteBaseProps<T> {
  /** Single-select mode (default) */
  multiple?: false
  /** Currently selected value */
  value: T | null
  /** Callback when selection changes */
  onChange: (value: T | null) => void
}

export interface AutocompleteMultipleProps<T = string> extends AutocompleteBaseProps<T> {
  /** Enable multi-select mode */
  multiple: true
  /** Currently selected values */
  value: T[]
  /** Callback when selection changes */
  onChange: (value: T[]) => void
  /** Maximum number of items that can be selected */
  maxItems?: number
  /** Render custom tag content */
  renderTag?: (option: AutocompleteOption<T>) => ReactNode
  /** Maximum number of visible tags. Set to "auto" for automatic calculation based on available width. Default "auto" */
  limitTags?: number | "auto"
  /** Custom render function for the "+N" overflow chip */
  getLimitTagsText?: (more: number) => ReactNode
}

export type AutocompleteProps<T = string> = AutocompleteSingleProps<T> | AutocompleteMultipleProps<T>

// Inner input styles matching Input component
const innerInputStyles = cn(
  "flex-1 min-w-[60px] bg-transparent border-none outline-none",
  "text-[18px] font-medium leading-6",
  "text-ods-text-primary placeholder:text-ods-text-secondary",
  "disabled:cursor-not-allowed"
)

function AutocompleteInner<T = string>(
  props: AutocompleteProps<T>,
  ref: ForwardedRef<HTMLDivElement>
) {
  const {
    options,
    disabled = false,
    startAdornment,
    showClearAll = true,
    className,
    dropdownClassName,
    freeSolo = false,
    label,
    error,
    filterOptions,
    renderOption,
    invalid = false,
    noOptionsText = "No options",
    inputValue: inputValueProp,
    onInputChange,
    loading = false,
    loadingText = "Loading...",
    creatable = false,
    onCreateOption,
    disableClientFilter = false,
    showChevron = true,
    clearOnOpen = true,
  } = props

  const multiple = props.multiple ?? false
  const placeholder = props.placeholder ?? (multiple ? "Add More..." : "Select...")

  // Multiple-only props
  const maxItems = multiple ? (props as AutocompleteMultipleProps<T>).maxItems : undefined
  const renderTag = multiple ? (props as AutocompleteMultipleProps<T>).renderTag : undefined
  const limitTagsProp = multiple ? ((props as AutocompleteMultipleProps<T>).limitTags ?? "auto") : "auto"
  const getLimitTagsText = multiple
    ? ((props as AutocompleteMultipleProps<T>).getLimitTagsText ?? ((more: number) => `+${more}`))
    : ((more: number) => `+${more}`)

  // Normalize value to array for internal use
  const valueArray: T[] = multiple
    ? (props.value as T[])
    : (props.value != null ? [props.value as T] : [])

  const [internalInputValue, setInternalInputValue] = useState("")
  const isInputControlled = inputValueProp !== undefined
  const inputValue = isInputControlled ? inputValueProp : internalInputValue

  const updateInputValue = (value: string, reason: AutocompleteInputChangeReason) => {
    if (!isInputControlled) {
      setInternalInputValue(value)
    }
    onInputChange?.(value, reason)
  }

  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const hiddenTagsPopupRef = useRef<HTMLDivElement>(null)

  const isInvalid = invalid || !!error

  // Combine refs
  useImperativeHandle(ref, () => containerRef.current as HTMLDivElement)

  // Get selected options
  const selectedOptions = useMemo(() => {
    return valueArray.map(v => options.find(opt => opt.value === v)).filter(Boolean) as AutocompleteOption<T>[]
  }, [valueArray, options])

  // Single mode: the currently selected option
  const selectedOption = !multiple && selectedOptions.length > 0 ? selectedOptions[0] : null

  // Placeholder logic
  const inputPlaceholder = multiple
    ? (valueArray.length === 0 ? placeholder : "Add More...")
    : placeholder

  // ---- Auto limit tags via shared hook ----
  const autoLimitTags = useAutoLimitTags({
    count: multiple ? selectedOptions.length : 0,
    limitTags: multiple ? limitTagsProp : 0,
    placeholder: inputPlaceholder,
  })

  const visibleCount = multiple ? autoLimitTags.visibleCount : 0
  const visibleTags = multiple ? selectedOptions.slice(0, visibleCount) : []
  const hiddenTags = multiple ? selectedOptions.slice(visibleCount) : []
  const hiddenTagsCount = multiple ? selectedOptions.length - visibleCount : 0

  const [showHiddenTags, setShowHiddenTags] = useState(false)
  const hiddenTagsRef = useRef<HTMLDivElement>(null)

  // Close hidden tags list on outside click
  useEffect(() => {
    if (!showHiddenTags) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      const inButton = hiddenTagsRef.current?.contains(target)
      const inPopup = hiddenTagsPopupRef.current?.contains(target)
      if (!inButton && !inPopup) {
        setShowHiddenTags(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showHiddenTags])

  // When clearOnOpen is false, populate input with selected label on open
  useEffect(() => {
    if (isOpen && !multiple && !clearOnOpen && selectedOption) {
      updateInputValue(selectedOption.label, 'reset')
    }
  }, [isOpen])

  // Input display value:
  // - Single mode, closed, has selection → show selected label
  // - Single mode, open, clearOnOpen=false → show inputValue (pre-filled with label)
  // - Otherwise → show inputValue (what user is typing)
  const inputDisplayValue = !multiple && !isOpen && selectedOption
    ? selectedOption.label
    : inputValue

  // Filter options based on inputValue
  const filteredOptions = useMemo(() => {
    if (disableClientFilter) {
      return options
    }

    if (filterOptions) {
      return filterOptions(options, inputValue)
    }

    if (!inputValue.trim()) {
      return options
    }

    const lowerInput = inputValue.toLowerCase()
    return options.filter(opt =>
      opt.label.toLowerCase().includes(lowerInput)
    )
  }, [options, inputValue, filterOptions, disableClientFilter])

  // Show "+ Create" option when creatable is on, user typed something, and nothing matched
  const showCreateOption = creatable && inputValue.trim().length > 0 && filteredOptions.length === 0

  // Handle creating a new option
  const handleCreate = () => {
    const trimmed = inputValue.trim()
    if (!trimmed) return

    const newValue = trimmed as T

    if (multiple) {
      if (maxItems && valueArray.length >= maxItems) return
      ;(props as AutocompleteMultipleProps<T>).onChange([...valueArray, newValue])
    } else {
      ;(props as AutocompleteSingleProps<T>).onChange(newValue)
    }

    updateInputValue("", 'reset')
    setIsOpen(false)
    onCreateOption?.(trimmed)
  }

  // Reset highlighted index when options change
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [filteredOptions.length])

  // Handle input change
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    updateInputValue(e.target.value, 'input')
    if (!isOpen) {
      setIsOpen(true)
    }
    setHighlightedIndex(-1)
  }

  // Handle option selection
  const handleSelect = (option: AutocompleteOption<T>) => {
    if (multiple) {
      // Multiple mode: toggle selection
      const isSelected = valueArray.includes(option.value)

      if (isSelected) {
        ;(props as AutocompleteMultipleProps<T>).onChange(valueArray.filter(v => v !== option.value))
      } else {
        if (maxItems && valueArray.length >= maxItems) {
          return
        }
        ;(props as AutocompleteMultipleProps<T>).onChange([...valueArray, option.value])
      }

      updateInputValue("", 'reset')
      autoLimitTags.inputRef.current?.focus()
    } else {
      // Single mode: select and close
      ;(props as AutocompleteSingleProps<T>).onChange(option.value)
      updateInputValue("", 'reset')
      setIsOpen(false)
    }
  }

  // Handle clear
  const handleClearAll = (e: ReactMouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (multiple) {
      ;(props as AutocompleteMultipleProps<T>).onChange([])
    } else {
      ;(props as AutocompleteSingleProps<T>).onChange(null)
    }
    updateInputValue("", 'clear')
    autoLimitTags.inputRef.current?.focus()
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
        }
        setHighlightedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        )
        break
      case "Enter":
        e.preventDefault()
        if (showCreateOption) {
          handleCreate()
        } else if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex])
        } else if (freeSolo && inputValue.trim()) {
          const newOption: AutocompleteOption<T> = {
            label: inputValue.trim(),
            value: inputValue.trim() as T
          }
          handleSelect(newOption)
        }
        break
      case "Escape":
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
      case "Backspace":
        break
    }
  }

  // Handle popover open/close
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      updateInputValue("", 'reset')
    }
    if (open) setShowHiddenTags(false)
    setIsOpen(open)
  }

  const canAddMore = multiple ? (!maxItems || valueArray.length < maxItems) : true
  const hasValue = valueArray.length > 0

  const popover = (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={handleOpenChange} modal={false}>
      <PopoverPrimitive.Anchor asChild>
        <div
          className={cn(
            // Layout — single line, no wrapping
            "flex items-center rounded-[6px] border min-h-11 md:min-h-12 cursor-text",
            "focus-within:outline-none",
            "transition-colors duration-200",
            "bg-ods-card border-ods-border",
            "group",
            !disabled && "hover:bg-ods-bg-hover hover:border-ods-border-hover active:bg-ods-bg-active active:border-ods-border-active",
            disabled && "!cursor-not-allowed bg-ods-bg",
            isOpen && !isInvalid && "border-ods-accent hover:border-ods-accent",
            isInvalid && "border-ods-error hover:border-ods-error"
          )}
          onClick={() => {
            if (!disabled) {
              autoLimitTags.inputRef.current?.focus()
              setIsOpen(true)
            }
          }}
        >
          {/* Start Adornment */}
          {startAdornment && (
            <span className={cn(
              "flex-shrink-0 pl-3 text-ods-text-secondary transition-colors duration-200 [&_svg]:size-4 md:[&_svg]:size-6",
              isOpen && !isInvalid && "text-ods-accent",
              isInvalid && "text-ods-error"
            )}>
              {startAdornment}
            </span>
          )}

          {/* Middle zone: tags + input — single line with overflow */}
          <div
            ref={autoLimitTags.middleRef}
            className="flex-1 flex items-center gap-2 min-w-0 overflow-hidden px-2"
          >
            {/* Tags (multiple mode only) */}
            {multiple && visibleTags.map((option) => (
              <Tag
                key={String(option.value)}
                variant="outline"
                labelClassName="truncate max-w-[90px]"
                label={renderTag ? renderTag(option) : option.label}
                onClose={!disabled ? () => {
                  ;(props as AutocompleteMultipleProps<T>).onChange(valueArray.filter(v => v !== option.value))
                } : undefined}
              />
            ))}

            {/* Overflow indicator button (multiple mode only) */}
            {multiple && hiddenTagsCount > 0 && (
              <div ref={hiddenTagsRef} className="shrink-0">
                <button
                  ref={autoLimitTags.badgeRef}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowHiddenTags(prev => {
                      if (!prev) setIsOpen(false)
                      return !prev
                    })
                  }}
                  className={cn(
                    "flex items-center h-8 px-2",
                    "bg-ods-card border border-ods-border rounded-[6px]",
                    "font-mono text-[14px] font-medium leading-5 text-ods-text-secondary uppercase tracking-[-0.28px]",
                    "hover:bg-ods-bg-hover transition-colors cursor-pointer"
                  )}
                >
                  {getLimitTagsText(hiddenTagsCount)}
                </button>
              </div>
            )}

            {/* Input */}
            {canAddMore && (
              <input
                ref={autoLimitTags.inputRef}
                type="text"
                value={inputDisplayValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsOpen(true)}
                placeholder={inputPlaceholder}
                disabled={disabled}
                className={innerInputStyles}
              />
            )}
          </div>

          {/* Clear / Chevron — pinned right */}
          <div className="flex items-center gap-1 shrink-0 pr-3">
            {showClearAll && hasValue && !disabled && isOpen && (
              <button
                type="button"
                onClick={handleClearAll}
                className="flex items-center justify-center hover:opacity-70 transition-opacity"
                aria-label="Clear all"
              >
                <XmarkCircleIcon className="text-ods-text-secondary size-4 md:size-6" />
              </button>
            )}
            {showChevron && (
              <Chevron02DownIcon
                className={cn(
                  "transition-all duration-200 size-4 md:size-6",
                  "text-ods-text-secondary",
                  isOpen && "rotate-180",
                  isOpen && !isInvalid && "text-ods-accent",
                  isInvalid && "text-ods-error"
                )}
              />
            )}
          </div>
        </div>
      </PopoverPrimitive.Anchor>

      <PopoverPrimitive.Content
        className={cn(
          "z-50 w-[var(--radix-popover-trigger-width)] mt-1",
          "bg-ods-card border border-ods-border rounded-[4px]",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
          dropdownClassName
        )}
        sideOffset={4}
        align="start"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          autoLimitTags.inputRef.current?.focus()
        }}
        onInteractOutside={(e) => {
          // Don't close if clicking inside the anchor/input container
          if (containerRef.current?.contains(e.target as Node)) {
            e.preventDefault()
          }
        }}
      >
        <ScrollAreaPrimitive.Root className="overflow-hidden">
          <ScrollAreaPrimitive.Viewport className="max-h-[240px] w-full">
            <div role="listbox">
              {loading ? (
                <div className="px-3 py-2 text-ods-text-secondary text-[14px]">
                  {loadingText}
                </div>
              ) : filteredOptions.length === 0 ? (
                showCreateOption ? (
                  <div
                    role="option"
                    aria-selected={false}
                    className={cn(
                      "flex items-center h-11 md:h-12 px-4 cursor-pointer transition-colors",
                      "text-[18px] font-medium leading-6 text-ods-accent",
                      "hover:bg-ods-bg-hover"
                    )}
                    onClick={handleCreate}
                  >
                    + Create &quot;{inputValue.trim()}&quot;
                  </div>
                ) : (
                  <div className="px-3 py-2 text-ods-text-secondary text-[14px]">
                    {freeSolo && inputValue.trim() ? (
                      <span>Press Enter to add &quot;{inputValue}&quot;</span>
                    ) : (
                      noOptionsText
                    )}
                  </div>
                )
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = valueArray.includes(option.value)
                  const isHighlighted = index === highlightedIndex

                  return (
                    <div
                      key={String(option.value)}
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "flex items-center h-11 md:h-12 px-4 cursor-pointer transition-colors border-b border-ods-border last:border-b-0",
                        "text-[18px] font-medium leading-6",
                        isHighlighted && "bg-ods-bg-surface",
                        isSelected ? "text-ods-accent" : "text-ods-text-primary",
                        !isHighlighted && "hover:bg-ods-bg-hover"
                      )}
                      onClick={() => handleSelect(option)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      {renderOption ? renderOption(option, isSelected) : (
                        <div className="flex items-center justify-between w-full min-w-0">
                          <span className="truncate">{option.label}</span>
                          {isSelected && (
                            <CheckIcon className="text-ods-accent" size={20} />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </ScrollAreaPrimitive.Viewport>
          <ScrollAreaPrimitive.Scrollbar
            className="hidden"
            orientation="vertical"
          >
            <ScrollAreaPrimitive.Thumb />
          </ScrollAreaPrimitive.Scrollbar>
        </ScrollAreaPrimitive.Root>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Root>
  )

  return (
    <FieldWrapper label={label} error={error} className={className}>
      <div className="relative" ref={containerRef}>
        {popover}

        {/* Hidden tags popup — outside overflow-hidden, positioned under badge */}
        {multiple && showHiddenTags && hiddenTagsCount > 0 && (
          <HiddenTagsPopup
            ref={hiddenTagsPopupRef}
            items={hiddenTags}
            disabled={disabled}
            style={{
              left: autoLimitTags.badgeRef.current
                ? autoLimitTags.badgeRef.current.getBoundingClientRect().left -
                  (containerRef.current?.getBoundingClientRect().left ?? 0)
                : 0,
            }}
            onRemove={(value) => {
              const newValue = valueArray.filter(v => v !== value)
              ;(props as AutocompleteMultipleProps<T>).onChange(newValue)
              if (typeof limitTagsProp === "number" && newValue.length <= limitTagsProp) setShowHiddenTags(false)
            }}
          />
        )}

        {/* Off-screen measurement containers for auto-limit */}
        {multiple && (
          <>
            <span
              ref={autoLimitTags.textMeasureRef}
              aria-hidden="true"
              className="absolute left-0 top-0 pointer-events-none invisible -z-10 whitespace-nowrap text-[18px] font-medium leading-6"
            >
              {inputPlaceholder}
            </span>
            <div
              ref={autoLimitTags.measureRef}
              aria-hidden="true"
              className="absolute left-0 top-0 flex gap-2 pointer-events-none invisible -z-10"
            >
              {selectedOptions.map((option) => (
                <Tag
                  key={`m-${String(option.value)}`}
                  variant="outline"
                  labelClassName="truncate max-w-[90px]"
                  label={renderTag ? renderTag(option) : option.label}
                  onClose={() => {}}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </FieldWrapper>
  )
}

// Use overloaded signatures so TS can narrow single vs multiple based on the `multiple` prop
type AutocompleteComponent = {
  <T = string>(props: AutocompleteMultipleProps<T> & { ref?: ForwardedRef<HTMLDivElement> }): ReactElement
  <T = string>(props: AutocompleteSingleProps<T> & { ref?: ForwardedRef<HTMLDivElement> }): ReactElement
}

export const Autocomplete = forwardRef(AutocompleteInner) as AutocompleteComponent
