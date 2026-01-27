'use client'

import React from 'react'
import { cn } from '../../utils/cn'
import { SearchIcon } from '../icons-v2-generated'

export interface HeaderGlobalSearchProps {
  /** Current search value */
  value?: string
  /** Callback when search value changes */
  onChange?: (value: string) => void
  /** Callback when search is submitted */
  onSubmit?: (value: string) => void
  /** Placeholder text */
  placeholder?: string
  /** Additional class names */
  className?: string
}

export function HeaderGlobalSearch({
  value = '',
  onChange,
  onSubmit,
  placeholder = 'Global Search',
  className
}: HeaderGlobalSearchProps) {
  const [internalValue, setInternalValue] = React.useState(value)

  const currentValue = onChange ? value : internalValue

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    if (onChange) {
      onChange(newValue)
    } else {
      setInternalValue(newValue)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit?.(currentValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSubmit?.(currentValue)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-1 items-center gap-2 h-full px-3",
        "bg-ods-card",
        className
      )}
    >
      <SearchIcon className="w-6 h-6 shrink-0 text-ods-text-secondary" />
      <input
        type="text"
        value={currentValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "flex-1 min-w-0 bg-transparent",
          "text-lg font-medium leading-6",
          "text-ods-text-primary placeholder:text-ods-text-secondary",
          "outline-none border-none"
        )}
      />
    </form>
  )
}

export default HeaderGlobalSearch
