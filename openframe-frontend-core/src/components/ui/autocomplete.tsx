"use client"

import * as PopoverPrimitive from "@radix-ui/react-popover"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"
import { CheckIcon } from "../icons-v2-generated/signs-and-symbols/check-icon"
import { XmarkCircleIcon } from "../icons-v2-generated/signs-and-symbols/xmark-circle-icon"
import { Chevron02DownIcon } from "../icons-v2-generated/arrows/chevron-02-down-icon"
import { Tag } from "./tag"
import * as React from "react"
import { cn } from "../../utils/cn"
import { FieldWrapper } from "./field-wrapper"

export interface AutocompleteOption<T = string> {
  label: string
  value: T
}

interface AutocompleteBaseProps<T = string> {
  /** Available options to select from */
  options: AutocompleteOption<T>[]
  /** Placeholder text */
  placeholder?: string
  /** Whether the component is disabled */
  disabled?: boolean
  /** Element displayed at the start of the input */
  startAdornment?: React.ReactNode
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
  renderOption?: (option: AutocompleteOption<T>, isSelected: boolean) => React.ReactNode
  /** When true, shows validation error styling */
  invalid?: boolean
  /** No options text */
  noOptionsText?: string
  /** Callback when input value changes */
  onInputChange?: (value: string) => void
  /** Loading state */
  loading?: boolean
  /** Loading text */
  loadingText?: string
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
  renderTag?: (option: AutocompleteOption<T>) => React.ReactNode
  /** Maximum number of tags to display before showing "+N" chip. Set to -1 to show all tags. */
  limitTags?: number
  /** Custom render function for the "+N" overflow chip */
  getLimitTagsText?: (more: number) => React.ReactNode
}

export type AutocompleteProps<T = string> = AutocompleteSingleProps<T> | AutocompleteMultipleProps<T>

// Shared container styles matching Input component
const containerStyles = cn(
  // Layout & spacing
  "flex items-center gap-2 rounded-[6px] border px-3 min-h-11 sm:min-h-12 cursor-text flex-wrap py-1",
  // Focus-within states
  "focus-within:outline-none",
  // Animations
  "transition-colors duration-200",
  // Theme palette
  "bg-ods-card border-ods-border"
)

// Inner input styles matching Input component
const innerInputStyles = cn(
  "flex-1 min-w-[100px] bg-transparent border-none outline-none",
  "text-[18px] font-medium leading-6",
  "text-ods-text-primary placeholder:text-ods-text-secondary",
  "disabled:cursor-not-allowed"
)

function AutocompleteInner<T = string>(
  props: AutocompleteProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
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
    onInputChange,
    loading = false,
    loadingText = "Loading...",
  } = props

  const multiple = props.multiple ?? false
  const placeholder = props.placeholder ?? (multiple ? "Add More..." : "Select...")

  // Multiple-only props
  const maxItems = multiple ? (props as AutocompleteMultipleProps<T>).maxItems : undefined
  const renderTag = multiple ? (props as AutocompleteMultipleProps<T>).renderTag : undefined
  const limitTags = multiple ? ((props as AutocompleteMultipleProps<T>).limitTags ?? -1) : -1
  const getLimitTagsText = multiple
    ? ((props as AutocompleteMultipleProps<T>).getLimitTagsText ?? ((more: number) => `+${more}`))
    : ((more: number) => `+${more}`)

  // Normalize value to array for internal use
  const valueArray: T[] = multiple
    ? (props.value as T[])
    : (props.value != null ? [props.value as T] : [])

  const [inputValue, setInputValue] = React.useState("")
  const [isOpen, setIsOpen] = React.useState(false)
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const isInvalid = invalid || !!error

  // Combine refs
  React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement)

  // Get selected options
  const selectedOptions = React.useMemo(() => {
    return valueArray.map(v => options.find(opt => opt.value === v)).filter(Boolean) as AutocompleteOption<T>[]
  }, [valueArray, options])

  // Single mode: the currently selected option
  const selectedOption = !multiple && selectedOptions.length > 0 ? selectedOptions[0] : null

  // Calculate visible and hidden tags based on limitTags (multiple only)
  const { visibleTags, hiddenTagsCount } = React.useMemo(() => {
    if (!multiple) return { visibleTags: [] as AutocompleteOption<T>[], hiddenTagsCount: 0 }
    if (limitTags === -1 || limitTags >= selectedOptions.length) {
      return { visibleTags: selectedOptions, hiddenTagsCount: 0 }
    }
    return {
      visibleTags: selectedOptions.slice(0, limitTags),
      hiddenTagsCount: selectedOptions.length - limitTags,
    }
  }, [multiple, selectedOptions, limitTags])

  // Input display value:
  // - Single mode, closed, has selection → show selected label
  // - Otherwise → show inputValue (what user is typing)
  const inputDisplayValue = !multiple && !isOpen && selectedOption
    ? selectedOption.label
    : inputValue

  // Filter options based on inputValue
  const filteredOptions = React.useMemo(() => {
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
  }, [options, inputValue, filterOptions])

  // Reset highlighted index when options change
  React.useEffect(() => {
    setHighlightedIndex(-1)
  }, [filteredOptions.length])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onInputChange?.(newValue)
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

      setInputValue("")
      inputRef.current?.focus()
    } else {
      // Single mode: select and close
      ;(props as AutocompleteSingleProps<T>).onChange(option.value)
      setInputValue("")
      setIsOpen(false)
    }
  }

  // Handle clear
  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (multiple) {
      ;(props as AutocompleteMultipleProps<T>).onChange([])
    } else {
      ;(props as AutocompleteSingleProps<T>).onChange(null)
    }
    setInputValue("")
    inputRef.current?.focus()
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
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
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
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
        if (multiple && !inputValue && valueArray.length > 0) {
          // Remove last tag in multiple mode
          ;(props as AutocompleteMultipleProps<T>).onChange(valueArray.slice(0, -1))
        }
        break
    }
  }

  // Handle popover open/close
  const handleOpenChange = (open: boolean) => {
    if (!open && !multiple) {
      // Reset inputValue when closing in single mode; display will show selected label
      setInputValue("")
    }
    setIsOpen(open)
  }

  const canAddMore = multiple ? (!maxItems || valueArray.length < maxItems) : true
  const hasValue = valueArray.length > 0
  const hasFieldChrome = label !== undefined || error !== undefined

  // Placeholder logic
  const inputPlaceholder = multiple
    ? (valueArray.length === 0 ? placeholder : "Add More...")
    : placeholder

  const popover = (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={handleOpenChange} modal={false}>
      <PopoverPrimitive.Anchor asChild>
        <div
          className={cn(
            containerStyles,
            "group",
            !disabled && "hover:border-ods-accent/30",
            disabled && "cursor-not-allowed opacity-50",
            isOpen && !isInvalid && "border-ods-accent hover:border-ods-accent",
            isInvalid && "border-ods-error hover:border-ods-error"
          )}
          onClick={() => {
            if (!disabled) {
              inputRef.current?.focus()
              if (!multiple) {
                // Clear input for fresh search in single mode
                setInputValue("")
              }
              setIsOpen(true)
            }
          }}
        >
          {/* Start Adornment */}
          {startAdornment && (
            <span className={cn(
              "flex-shrink-0 text-ods-text-secondary transition-colors duration-200 [&_svg]:size-4 sm:[&_svg]:size-6",
              isOpen && !isInvalid && "text-ods-accent",
              isInvalid && "text-ods-error"
            )}>
              {startAdornment}
            </span>
          )}

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

          {/* Overflow indicator (multiple mode only) */}
          {multiple && hiddenTagsCount > 0 && (
            <div
              className={cn(
                "flex items-center h-8 px-2 shrink-0",
                "bg-ods-card border border-ods-border rounded-[6px]",
                "font-mono text-[14px] font-medium leading-5 text-ods-text-secondary uppercase tracking-[-0.28px]"
              )}
            >
              {getLimitTagsText(hiddenTagsCount)}
            </div>
          )}

          {/* Input */}
          {canAddMore && (
            <input
              ref={inputRef}
              type="text"
              value={inputDisplayValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (!multiple) {
                  // Clear input for fresh search in single mode
                  setInputValue("")
                }
                setIsOpen(true)
              }}
              placeholder={inputPlaceholder}
              disabled={disabled}
              className={innerInputStyles}
            />
          )}

          {/* Clear / Chevron */}
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            {showClearAll && hasValue && !disabled && isOpen && (
              <button
                type="button"
                onClick={handleClearAll}
                className="flex items-center justify-center hover:opacity-70 transition-opacity"
                aria-label="Clear all"
              >
                <XmarkCircleIcon className="text-ods-text-secondary" size={24} />
              </button>
            )}
            <Chevron02DownIcon
              className={cn(
                "transition-all duration-200",
                "text-ods-text-secondary",
                isOpen && "rotate-180",
                isOpen && !isInvalid && "text-ods-accent",
                isInvalid && "text-ods-error"
              )}
              size={24}
            />
          </div>
        </div>
      </PopoverPrimitive.Anchor>

      <PopoverPrimitive.Content
        className={cn(
          "z-50 w-[var(--radix-popover-trigger-width)] mt-1",
          "bg-ods-card border border-ods-border rounded-[4px]",
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
                <div className="px-3 py-2 text-ods-text-secondary text-[14px]">
                  {freeSolo && inputValue.trim() ? (
                    <span>Press Enter to add &quot;{inputValue}&quot;</span>
                  ) : (
                    noOptionsText
                  )}
                </div>
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
                        "flex items-center h-11 sm:h-12 px-4 cursor-pointer transition-colors border-b border-ods-border last:border-b-0",
                        "text-[18px] font-medium leading-6",
                        isHighlighted && "bg-ods-bg-surface",
                        isSelected ? "text-ods-accent" : "text-ods-text-primary",
                        !isHighlighted && "hover:bg-ods-bg-hover"
                      )}
                      onClick={() => handleSelect(option)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      {renderOption ? renderOption(option, isSelected) : (
                        <div className="flex items-center justify-between w-full">
                          <span>{option.label}</span>
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

  if (hasFieldChrome) {
    return (
      <FieldWrapper label={label} error={error} className={className}>
        <div className="relative" ref={containerRef}>
          {popover}
        </div>
      </FieldWrapper>
    )
  }

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      {popover}
    </div>
  )
}

// Use overloaded signatures so TS can narrow single vs multiple based on the `multiple` prop
type AutocompleteComponent = {
  <T = string>(props: AutocompleteMultipleProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }): React.ReactElement
  <T = string>(props: AutocompleteSingleProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }): React.ReactElement
}

export const Autocomplete = React.forwardRef(AutocompleteInner) as AutocompleteComponent
