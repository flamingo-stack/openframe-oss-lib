'use client'

import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as React from 'react'
import { CheckIcon, PenEditIcon, SearchIcon, UserIcon, UserPlusIcon } from '../icons-v2-generated'
import { cn } from '../../utils/cn'
import { Autocomplete, type AutocompleteOption } from './autocomplete'
import { Input } from './input'
import { SquareAvatar } from './square-avatar'

export interface TicketAssigneeOption {
  value: string
  label: string
  imageUrl?: string
}

export interface AssigneeDropdownProps {
  currentAssignee?: {
    id: string
    name: string
    avatarSrc?: string
  }
  options: TicketAssigneeOption[]
  isLoading?: boolean
  isPending?: boolean
  onAssign: (userId: string | null) => void
  variant?: 'default' | 'compact'
  className?: string
}

export function AssigneeDropdown(props: AssigneeDropdownProps) {
  if (props.variant === 'compact') {
    return <CompactAssigneeDropdown {...props} />
  }
  return <DefaultAssigneeDropdown {...props} />
}

function CompactAssigneeDropdown({
  currentAssignee,
  options,
  isLoading,
  onAssign,
  className,
}: AssigneeDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const hasAssignee = !!currentAssignee

  React.useEffect(() => {
    if (!isOpen) setSearch('')
  }, [isOpen])

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [options, search])

  const orderedOptions = React.useMemo(() => {
    if (!currentAssignee) return filtered
    const current = filtered.find(o => o.value === currentAssignee.id)
    if (!current) return filtered
    return [current, ...filtered.filter(o => o.value !== currentAssignee.id)]
  }, [filtered, currentAssignee])

  const handleSelect = (userId: string) => {
    const next = currentAssignee?.id === userId ? null : userId
    onAssign(next)
    setIsOpen(false)
  }

  const trigger = hasAssignee ? (
    <button
      type="button"
      aria-label="Change assignee"
      className={cn(
        'shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus',
        className,
      )}
    >
      <SquareAvatar
        src={currentAssignee.avatarSrc}
        alt={currentAssignee.name}
        fallback={currentAssignee.name || 'User'}
        size="sm"
        variant="round"
      />
    </button>
  ) : (
    <button
      type="button"
      aria-label="Assign user"
      className={cn(
        'size-8 rounded-full border border-ods-border flex items-center justify-center shrink-0',
        'text-ods-text-secondary hover:text-ods-accent hover:border-ods-accent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus',
        className,
      )}
    >
      <UserPlusIcon className="size-4" />
    </button>
  )

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          className={cn(
            'z-50 w-72 bg-ods-card border border-ods-border rounded-[6px] shadow-lg overflow-hidden',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
          )}
        >
          <div className="p-[var(--spacing-system-xs)] border-b border-ods-border">
            <Input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users..."
              startAdornment={<SearchIcon className="size-4 text-ods-text-secondary" />}
            />
          </div>
          <div className="max-h-80 overflow-y-auto py-[var(--spacing-system-xs)]" role="listbox">
            {isLoading ? (
              <div className="px-[var(--spacing-system-sf)] py-[var(--spacing-system-s)] text-h5 text-ods-text-secondary">
                Loading…
              </div>
            ) : orderedOptions.length === 0 ? (
              <div className="px-[var(--spacing-system-sf)] py-[var(--spacing-system-s)] text-h5 text-ods-text-secondary">
                No users found
              </div>
            ) : (
              orderedOptions.map(opt => {
                const isCurrent = currentAssignee?.id === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isCurrent}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      'flex items-center gap-[var(--spacing-system-xs)] w-full px-[var(--spacing-system-sf)] py-[var(--spacing-system-xs)] text-left',
                      'hover:bg-ods-bg-hover transition-colors',
                      isCurrent && 'bg-ods-bg-hover',
                    )}
                  >
                    <SquareAvatar
                      src={opt.imageUrl}
                      alt={opt.label}
                      fallback={opt.label}
                      size="sm"
                      variant="round"
                      className="h-6 w-6 shrink-0"
                    />
                    <span className="flex-1 truncate text-h4 text-ods-text-primary">{opt.label}</span>
                    {isCurrent && <CheckIcon className="size-4 shrink-0 text-ods-accent" />}
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

function DefaultAssigneeDropdown({
  currentAssignee,
  options,
  isLoading,
  onAssign,
  className,
}: AssigneeDropdownProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const hasAssignee = !!currentAssignee

  const renderOption = React.useCallback((option: AutocompleteOption) => {
    const opt = option as TicketAssigneeOption
    return (
      <div className="flex items-center gap-[var(--spacing-system-sf)] w-full min-w-0">
        <SquareAvatar
          src={opt.imageUrl}
          alt={opt.label}
          fallback={opt.label}
          size="sm"
          variant="round"
          className="h-6 w-6 shrink-0"
        />
        <span className="truncate">{opt.label}</span>
      </div>
    )
  }, [])

  if (isEditing) {
    return (
      <div className={cn('min-w-0', className)}>
        <Autocomplete
          options={options}
          value={currentAssignee?.id ?? null}
          onChange={val => {
            onAssign(val)
            setIsEditing(false)
          }}
          placeholder="Search users..."
          loading={isLoading}
          showChevron={false}
          startAdornment={
            hasAssignee ? (
              <SquareAvatar
                src={currentAssignee!.avatarSrc}
                alt={currentAssignee!.name}
                fallback={currentAssignee!.name || 'User'}
                size="sm"
                variant="round"
                className="h-6 w-6"
              />
            ) : (
              <UserIcon className="size-5 text-ods-text-secondary" />
            )
          }
          renderOption={renderOption}
        />
        <span className="text-h6 text-ods-text-secondary truncate block mt-0.5">Assigned</span>
      </div>
    )
  }

  if (hasAssignee) {
    return (
      <div className={cn('flex items-center gap-[var(--spacing-system-xs)] min-w-0', className)}>
        <SquareAvatar
          src={currentAssignee!.avatarSrc}
          alt={currentAssignee!.name}
          fallback={currentAssignee!.name || 'User'}
          size="md"
          variant="round"
          className="shrink-0"
        />
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-[var(--spacing-system-xxs)] w-full min-w-0">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-[var(--spacing-system-xxs)] cursor-pointer group text-left"
              >
                <PenEditIcon className="size-4 shrink-0 text-ods-text-secondary group-hover:text-ods-accent transition-colors" />
                <span className="text-h4 text-ods-text-primary truncate">{currentAssignee!.name}</span>
              </button>
            </div>
            <span className="text-h6 text-ods-text-secondary truncate">Assigned</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('min-w-0', className)}>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="flex items-center gap-[var(--spacing-system-xxs)] text-h4 text-ods-accent underline truncate cursor-pointer hover:opacity-80 transition-opacity text-left"
      >
        <UserIcon className="size-4 shrink-0" />
        <span>Assign User</span>
      </button>
      <span className="text-h6 text-ods-text-secondary truncate block">Assigned</span>
    </div>
  )
}
