'use client'

import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as React from 'react'
import { cn } from '../../utils/cn'
import { CheckIcon, PlusIcon, SearchIcon, TrashIcon } from '../icons-v2-generated'
import { Button } from './button'
import { Input } from './input'

export interface TagSelectOption {
  id: string
  label: string
}

export interface TagSelectDropdownProps {
  /** All selectable tags. */
  options: TagSelectOption[]
  /** IDs of the currently selected tags. */
  selectedIds: string[]
  /** Called with the next full selection whenever a tag is toggled. */
  onChange: (ids: string[]) => void
  /** Called when the inline "Create" row is chosen. Omit to disable creation. */
  onCreate?: (name: string) => void
  /** Max length for a newly created tag name. Omit for no limit. */
  maxCreateLength?: number
  /** Called when a row's hover trash button is clicked. Omit to hide delete. */
  onDelete?: (id: string) => void
  isCreating?: boolean
  isDeleting?: boolean
  /** Trigger button label. */
  triggerLabel?: string
  searchPlaceholder?: string
  disabled?: boolean
  align?: 'start' | 'center' | 'end'
  /** Forwarded to the trigger button. */
  className?: string
}

/**
 * Multi-select tag picker rendered as a button-triggered dropdown (the
 * multi-select sibling of the compact `AssigneeDropdown`): a trigger opens a
 * popover with an internal search field, a checkable option list, and an
 * inline "Create" row. Selected chips are rendered by the caller.
 */
export function TagSelectDropdown({
  options,
  selectedIds,
  onChange,
  onCreate,
  maxCreateLength,
  onDelete,
  isCreating = false,
  isDeleting = false,
  triggerLabel = 'Add Tags',
  searchPlaceholder = 'Search or create tags...',
  disabled = false,
  align = 'start',
  className,
}: TagSelectDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  React.useEffect(() => {
    if (!isOpen) setSearch('')
  }, [isOpen])

  const query = search.trim()
  const filtered = React.useMemo(() => {
    const q = query.toLowerCase()
    if (!q) return options
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [options, query])

  // Selected tags float to the top of the list.
  const ordered = React.useMemo(() => {
    const selected = filtered.filter(o => selectedIds.includes(o.id))
    const rest = filtered.filter(o => !selectedIds.includes(o.id))
    return [...selected, ...rest]
  }, [filtered, selectedIds])

  const showCreate = !!onCreate && !!query && !options.some(o => o.label.toLowerCase() === query.toLowerCase())
  const isCreateTooLong = maxCreateLength != null && query.length > maxCreateLength
  const canCreate = showCreate && !isCreateTooLong

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id])
  }

  const handleCreate = () => {
    if (!onCreate || !canCreate) return
    onCreate(query)
    setSearch('')
  }

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          size="small"
          leftIcon={<PlusIcon />}
          disabled={disabled}
          className={cn('w-fit focus-visible:ring-0', className)}
        >
          {triggerLabel}
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={6}
          className={cn(
            'z-50 w-72 bg-ods-card border border-ods-border rounded-[6px] shadow-lg overflow-hidden',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
          )}
        >
          <div className="border-b border-ods-border">
            <Input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && canCreate) {
                  e.preventDefault()
                  handleCreate()
                }
              }}
              placeholder={searchPlaceholder}
              startAdornment={<SearchIcon className="size-4 text-ods-text-secondary" />}
              className="rounded-none border-0"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-[var(--spacing-system-xs)]" role="listbox">
            {ordered.map(opt => {
              const isSelected = selectedIds.includes(opt.id)
              return (
                <div
                  key={opt.id}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onClick={() => toggle(opt.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggle(opt.id)
                    }
                  }}
                  className={cn(
                    'group/item flex items-center gap-[var(--spacing-system-xs)] w-full cursor-pointer text-left',
                    'px-[var(--spacing-system-sf)] py-[var(--spacing-system-xs)]',
                    'hover:bg-ods-bg-hover transition-colors',
                    isSelected && 'bg-ods-bg-hover',
                  )}
                >
                  <span
                    className={cn('flex-1 truncate text-h4', isSelected ? 'text-ods-accent' : 'text-ods-text-primary')}
                    title={opt.label}
                  >
                    {opt.label}
                  </span>
                  {isSelected && <CheckIcon className="size-4 shrink-0 text-ods-accent" />}
                  {onDelete && !isSelected && (
                    <button
                      type="button"
                      aria-label={`Delete tag ${opt.label}`}
                      onClick={e => {
                        e.stopPropagation()
                        onDelete(opt.id)
                      }}
                      disabled={isDeleting}
                      className={cn(
                        'shrink-0 opacity-0 transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100',
                        'disabled:opacity-50 disabled:pointer-events-none',
                      )}
                    >
                      <TrashIcon className="size-4 text-ods-error" />
                    </button>
                  )}
                </div>
              )
            })}

            {showCreate &&
              (isCreateTooLong ? (
                <div className="flex items-center gap-[var(--spacing-system-xs)] w-full px-[var(--spacing-system-sf)] py-[var(--spacing-system-xs)] text-h5 text-ods-error">
                  Maximum {maxCreateLength} characters
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating}
                  className={cn(
                    'flex items-center gap-[var(--spacing-system-xs)] w-full px-[var(--spacing-system-sf)] py-[var(--spacing-system-xs)] text-left',
                    'hover:bg-ods-bg-hover transition-colors disabled:opacity-50 disabled:pointer-events-none',
                  )}
                >
                  <PlusIcon className="size-4 shrink-0 text-ods-accent" />
                  <span className="flex-1 truncate text-h4 text-ods-accent" title={`Create "${query}"`}>
                    Create &ldquo;{query}&rdquo;
                  </span>
                </button>
              ))}

            {filtered.length === 0 && !showCreate && (
              <div className="px-[var(--spacing-system-sf)] py-[var(--spacing-system-s)] text-h5 text-ods-text-secondary">
                No tags found
              </div>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
