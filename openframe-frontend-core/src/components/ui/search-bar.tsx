'use client'

import { Loader2 } from "lucide-react"
import React, { useCallback, useState } from "react"
import { cn } from "../../utils/cn"
import { SearchIcon } from "../icons-v2-generated"

export interface SearchBarProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onSubmit'> {
  /**
   * Icon to display on the left side of the search input
   * Defaults to Search icon from lucide-react
   */
  icon?: React.ReactNode
  /**
   * Placeholder text for the search input
   */
  placeholder?: string
  /**
   * Callback function called when search value changes
   */
  onSubmit?: (value: string) => void
  /**
   * Initial value for the search input
   */
  value?: string
  /**
   * Additional class names for styling
   */
  className?: string
  /**
   * Whether the search input is disabled
   */
  disabled?: boolean
  /**
   * Whether to show loading indicator
   */
  loading?: boolean
}

export function SearchBar({
  icon,
  placeholder = "Search...",
  onSubmit,
  value: controlledValue,
  className,
  disabled = false,
  loading = false,
  ...props
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState("")
  
  // Use controlled value if provided, otherwise use internal state
  const inputValue = controlledValue !== undefined ? controlledValue : internalValue
  
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value
    
    // Update internal state if not controlled
    if (controlledValue === undefined) {
      setInternalValue(newValue)
    }
    
    // Call the search handler
    onSubmit?.(newValue)
  }, [controlledValue, onSubmit])

  return (
    <div 
      className={cn(
        "relative bg-[#212121] border border-[#3a3a3a] rounded-[6px] w-full h-10 sm:h-12",
        "focus-within:border-[#555555] transition-colors duration-200",
        "flex items-center",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* Container for input and icon */}
      <div className="flex items-center gap-2 px-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-4 h-4 sm:w-6 sm:h-6 text-[#888888]">
          {loading ? (
            <Loader2 className="w-full h-full animate-spin" />
          ) : (
            icon || <SearchIcon className="w-full h-full" />
          )}
        </div>
        
        {/* Input field */}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "flex-1 bg-transparent border-none outline-none h-full",
            "font-['DM_Sans'] font-medium text-[14px] sm:text-[18px] leading-[20px] sm:leading-[24px]",
            "text-[#fafafa] placeholder:text-[#888888]",
            "disabled:cursor-not-allowed"
          )}
          {...props}
        />
      </div>
    </div>
  )
}