"use client"

import * as PopoverPrimitive from "@radix-ui/react-popover"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"
import { Check, ChevronDown, Search, X } from "lucide-react"
import * as React from "react"
import { cn } from "../../utils/cn"

export interface AutocompleteOption<T = string> {
  label: string
  value: T
}

export interface AutocompleteProps<T = string> {
  /** Available options to select from */
  options: AutocompleteOption<T>[]
  /** Currently selected values */
  value: T[]
  /** Callback when selection changes */
  onChange: (value: T[]) => void
  /** Placeholder text when no selection and no input */
  placeholder?: string
  /** Whether the component is disabled */
  disabled?: boolean
  /** Maximum number of items that can be selected */
  maxItems?: number
  /** Whether to show search icon */
  showSearchIcon?: boolean
  /** Whether to show clear all button */
  showClearAll?: boolean
  /** Custom className for the container */
  className?: string
  /** Custom className for the dropdown */
  dropdownClassName?: string
  /** When true, allows creating new options by typing */
  freeSolo?: boolean
  /** Label for the input */
  label?: string
  /** Custom filter function */
  filterOptions?: (options: AutocompleteOption<T>[], inputValue: string) => AutocompleteOption<T>[]
  /** Render custom option content */
  renderOption?: (option: AutocompleteOption<T>, isSelected: boolean) => React.ReactNode
  /** Render custom tag content */
  renderTag?: (option: AutocompleteOption<T>) => React.ReactNode
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
  /** Maximum number of tags to display before showing "+N" chip. Set to -1 to show all tags. */
  limitTags?: number
  /** Custom render function for the "+N" overflow chip */
  getLimitTagsText?: (more: number) => React.ReactNode
}

// Shared container styles matching Input component
const containerStyles = cn(
  // Layout & spacing
  "flex items-center gap-2 rounded-[6px] border px-3 min-h-11 sm:min-h-12 cursor-text flex-wrap py-2",
  // Focus-within states
  "focus-within:outline-none focus-within:ring-1 focus-within:ring-ods-accent/20 focus-within:ring-offset-0",
  // Animations
  "transition-colors duration-200",
  // Theme palette
  "bg-[#212121] border-[#3a3a3a]"
)

// Inner input styles matching Input component
const innerInputStyles = cn(
  "flex-1 min-w-[100px] bg-transparent border-none outline-none",
  "text-[18px] font-medium leading-6",
  "text-ods-text-primary placeholder:text-[#888]",
  "disabled:cursor-not-allowed"
)

function AutocompleteInner<T = string>(
  {
    options,
    value,
    onChange,
    placeholder = "Add More...",
    disabled = false,
    maxItems,
    showSearchIcon = true,
    showClearAll = true,
    className,
    dropdownClassName,
    freeSolo = false,
    label,
    filterOptions,
    renderOption,
    renderTag,
    invalid = false,
    noOptionsText = "No options",
    onInputChange,
    loading = false,
    loadingText = "Loading...",
    limitTags = -1,
    getLimitTagsText = (more: number) => `+${more}`,
  }: AutocompleteProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const [inputValue, setInputValue] = React.useState("")
  const [isOpen, setIsOpen] = React.useState(false)
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Combine refs
  React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement)

  // Get selected options
  const selectedOptions = React.useMemo(() => {
    return value.map(v => options.find(opt => opt.value === v)).filter(Boolean) as AutocompleteOption<T>[]
  }, [value, options])

  // Calculate visible and hidden tags based on limitTags
  const { visibleTags, hiddenTagsCount } = React.useMemo(() => {
    if (limitTags === -1 || limitTags >= selectedOptions.length) {
      return { visibleTags: selectedOptions, hiddenTagsCount: 0 }
    }
    return {
      visibleTags: selectedOptions.slice(0, limitTags),
      hiddenTagsCount: selectedOptions.length - limitTags
    }
  }, [selectedOptions, limitTags])

  // Filter options based on input
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
  const handleSelect = (option: AutocompleteOption<T>, keepOpen = true) => {
    const isSelected = value.includes(option.value)

    if (isSelected) {
      onChange(value.filter(v => v !== option.value))
    } else {
      if (maxItems && value.length >= maxItems) {
        return
      }
      onChange([...value, option.value])
    }

    setInputValue("")
    if (keepOpen) {
      // Keep dropdown open and maintain focus
      inputRef.current?.focus()
    }
  }

  // Handle tag removal
  const handleRemoveTag = (valueToRemove: T, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter(v => v !== valueToRemove))
  }

  // Handle clear all
  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onChange([])
    setInputValue("")
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
        if (!inputValue && value.length > 0) {
          onChange(value.slice(0, -1))
        }
        break
    }
  }

  const canAddMore = !maxItems || value.length < maxItems

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      {label && (
        <label className="block mb-2 font-['DM_Sans'] text-[16px] font-medium text-ods-text-primary">
          {label}
        </label>
      )}

      <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen} modal={false}>
        <PopoverPrimitive.Anchor asChild>
          <div
            className={cn(
              containerStyles,
              !disabled && "hover:border-ods-accent/30 focus-within:border-ods-accent",
              disabled && "cursor-not-allowed opacity-50",
              invalid && "border-red-500 focus-within:ring-red-500"
            )}
            onClick={() => {
              if (!disabled) {
                inputRef.current?.focus()
                setIsOpen(true)
              }
            }}
          >
            {/* Search Icon */}
            {showSearchIcon && (
              <Search className="h-6 w-6 shrink-0 text-[#888]" />
            )}

            {/* Tags */}
            {visibleTags.map((option) => (
              <div
                key={String(option.value)}
                className={cn(
                  "flex items-center gap-2 h-6 px-2 shrink-0",
                  "bg-[#212121] border border-[#3a3a3a] rounded-[6px]",
                  "font-mono text-[14px] font-medium leading-5 text-ods-text-primary uppercase tracking-[-0.28px]"
                )}
              >
                {renderTag ? renderTag(option) : (
                  <span className="truncate max-w-[120px]">{option.label}</span>
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => handleRemoveTag(option.value, e)}
                    className="flex items-center justify-center hover:opacity-70 transition-opacity"
                    aria-label={`Remove ${option.label}`}
                  >
                    <X className="h-5 w-5 text-[#888]" />
                  </button>
                )}
              </div>
            ))}

            {/* Overflow indicator */}
            {hiddenTagsCount > 0 && (
              <div
                className={cn(
                  "flex items-center h-8 px-2 shrink-0",
                  "bg-[#212121] border border-[#3a3a3a] rounded-[6px]",
                  "font-mono text-[14px] font-medium leading-5 text-[#888] uppercase tracking-[-0.28px]"
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
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsOpen(true)}
                placeholder={value.length === 0 ? placeholder : "Add More..."}
                disabled={disabled}
                className={innerInputStyles}
              />
            )}

            {/* Clear All / Chevron */}
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              {showClearAll && value.length > 0 && !disabled && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="flex items-center justify-center hover:opacity-70 transition-opacity"
                  aria-label="Clear all"
                >
                  <X className="h-6 w-6 text-[#888]" />
                </button>
              )}
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-[#888] transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
              />
            </div>
          </div>
        </PopoverPrimitive.Anchor>

        <PopoverPrimitive.Content
          className={cn(
            "z-50 w-[var(--radix-popover-trigger-width)] mt-1",
            "bg-[#212121] border border-[#3a3a3a] rounded-[6px]",
            "shadow-lg",
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
                  <div className="px-3 py-2 text-[#888] text-[14px]">
                    {loadingText}
                  </div>
                ) : filteredOptions.length === 0 ? (
                  <div className="px-3 py-2 text-[#888] text-[14px]">
                    {freeSolo && inputValue.trim() ? (
                      <span>Press Enter to add &quot;{inputValue}&quot;</span>
                    ) : (
                      noOptionsText
                    )}
                  </div>
                ) : (
                  filteredOptions.map((option, index) => {
                    const isSelected = value.includes(option.value)
                    const isHighlighted = index === highlightedIndex

                    return (
                      <div
                        key={String(option.value)}
                        role="option"
                        aria-selected={isSelected}
                        className={cn(
                          "px-3 py-2 cursor-pointer transition-colors",
                          "font-['DM_Sans'] text-[16px] font-medium",
                          isHighlighted && "bg-[#3a3a3a]",
                          isSelected ? "text-ods-accent" : "text-ods-text-primary",
                          !isHighlighted && "hover:bg-[#2a2a2a]"
                        )}
                        onClick={() => handleSelect(option)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                      >
                        {renderOption ? renderOption(option, isSelected) : (
                          <div className="flex items-center justify-between">
                            <span>{option.label}</span>
                            {isSelected && (
                              <Check className="h-4 w-4 text-ods-accent" />
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
              className="flex touch-none select-none p-0.5 bg-transparent transition-colors duration-150 ease-out data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:h-2.5"
              orientation="vertical"
            >
              <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-[#3a3a3a] before:absolute before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:h-full before:min-h-[44px] before:w-full before:min-w-[44px]" />
            </ScrollAreaPrimitive.Scrollbar>
          </ScrollAreaPrimitive.Root>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Root>
    </div>
  )
}

// Use a type assertion to preserve generics with forwardRef
export const Autocomplete = React.forwardRef(AutocompleteInner) as <T = string>(
  props: AutocompleteProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => React.ReactElement
