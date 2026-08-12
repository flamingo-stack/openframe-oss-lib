'use client'

import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as React from 'react'
import { CheckIcon, SearchIcon } from '../icons-v2-generated'
import { Chevron02DownIcon } from '../icons-v2-generated/arrows/chevron-02-down-icon'
import { cn } from '../../utils/cn'
import { useKeyboardCollisionPadding } from '../../hooks/ui/use-keyboard-collision-padding'
import { Input } from './input'

export interface SearchableSelectOption {
  value: string
  label: string
  /** Optional leading visual for the option row (avatar, icon, badge). */
  icon?: React.ReactNode
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[]
  /** Currently selected option value; null/undefined when nothing is selected. */
  value?: string | null
  onValueChange: (value: string) => void
  /** Default trigger text while nothing is selected. */
  placeholder?: string
  /** Placeholder of the search input rendered as the first dropdown item. */
  searchPlaceholder?: string
  emptyText?: string
  loadingText?: string
  isLoading?: boolean
  disabled?: boolean
  /**
   * Custom trigger node (rendered via Popover.Trigger asChild). When omitted,
   * a select-like button (Input/SelectTrigger styling, chevron, placeholder)
   * is rendered.
   */
  trigger?: React.ReactNode
  /** Custom option-row renderer; default is icon + label + selected check. */
  renderOption?: (option: SearchableSelectOption, isSelected: boolean) => React.ReactNode
  align?: 'start' | 'center' | 'end'
  /** Classes for the default trigger button. */
  className?: string
  /** Classes for the popover content (e.g. a fixed width for icon triggers). */
  contentClassName?: string
}

/**
 * Select-style dropdown whose first item is a search field filtering the
 * option list — the pattern used by the ticket assignee picker ("Search
 * users...") generalized for any entity (devices, users, ...). Provide a
 * custom `trigger` for icon-button use cases; the default trigger looks and
 * behaves like `SelectTrigger`.
 */
export function SearchableSelect({
  options,
  value = null,
  onValueChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyText = 'No results found',
  loadingText = 'Loading…',
  isLoading = false,
  disabled = false,
  trigger,
  renderOption,
  align = 'start',
  className,
  contentClassName,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const keyboardPadding = useKeyboardCollisionPadding()

  React.useEffect(() => {
    if (!isOpen) setSearch('')
  }, [isOpen])

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [options, search])

  const selectedOption = React.useMemo(
    () => (value != null ? options.find(o => o.value === value) : undefined),
    [options, value],
  )

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue)
    setIsOpen(false)
  }

  const defaultTrigger = (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        // Mirrors SelectTrigger so the closed state is indistinguishable from
        // the regular Select.
        'flex w-full items-center justify-between gap-2 rounded-md border px-3 h-11 md:h-12 outline-none text-left',
        'text-h4 bg-ods-card border-ods-border',
        selectedOption ? 'text-ods-text-primary' : 'text-ods-text-secondary',
        'enabled:hover:bg-ods-bg-hover enabled:hover:border-ods-border-hover enabled:active:bg-ods-bg-active enabled:active:border-ods-border-active',
        'data-[state=open]:border-ods-accent data-[state=open]:hover:border-ods-accent',
        'group disabled:!cursor-not-allowed disabled:bg-ods-bg transition-colors duration-200 cursor-pointer',
        className,
      )}
    >
      <span className="line-clamp-1">{selectedOption ? selectedOption.label : placeholder}</span>
      <Chevron02DownIcon
        className="shrink-0 text-ods-text-secondary transition-all duration-200 group-data-[state=open]:rotate-180 group-data-[state=open]:text-ods-accent"
        size={24}
      />
    </button>
  )

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={disabled ? undefined : setIsOpen} modal={false}>
      <PopoverPrimitive.Trigger asChild>{trigger ?? defaultTrigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={6}
          // The search field below raises the software keyboard the moment this
          // opens — see useKeyboardCollisionPadding for why neither the collision
          // viewport nor the available height knows about it otherwise.
          collisionPadding={{ bottom: keyboardPadding }}
          className={cn(
            'z-50 min-w-[var(--radix-popover-trigger-width)] bg-ods-card border border-ods-border rounded-md shadow-lg overflow-hidden',
            'flex flex-col max-h-[var(--radix-popper-available-height)]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
            contentClassName,
          )}
        >
          <div className="shrink-0 border-b border-ods-border">
            <Input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              startAdornment={<SearchIcon className="size-4 text-ods-text-secondary" />}
              className="rounded-none border-0"
            />
          </div>
          <div className="min-h-0 max-h-80 overflow-y-auto py-[var(--spacing-system-xs)]" role="listbox">
            {isLoading ? (
              <div className="px-[var(--spacing-system-sf)] py-[var(--spacing-system-s)] text-h5 text-ods-text-secondary">
                {loadingText}
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-[var(--spacing-system-sf)] py-[var(--spacing-system-s)] text-h5 text-ods-text-secondary">
                {emptyText}
              </div>
            ) : (
              filtered.map(opt => {
                const isSelected = value === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      'flex items-center gap-[var(--spacing-system-xs)] w-full px-[var(--spacing-system-sf)] py-[var(--spacing-system-xs)] text-left',
                      'hover:bg-ods-bg-hover transition-colors',
                      isSelected && 'bg-ods-bg-hover',
                    )}
                  >
                    {renderOption ? (
                      renderOption(opt, isSelected)
                    ) : (
                      <>
                        {opt.icon}
                        <span className="flex-1 truncate text-h4 text-ods-text-primary" title={opt.label}>
                          {opt.label}
                        </span>
                        {isSelected && <CheckIcon className="size-4 shrink-0 text-ods-accent" />}
                      </>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
