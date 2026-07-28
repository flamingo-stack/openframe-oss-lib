'use client'

import * as React from 'react'
import { PenEditIcon, UserIcon, UserPlusIcon } from '../icons-v2-generated'
import { cn } from '../../utils/cn'
import { Autocomplete, type AutocompleteOption } from './autocomplete'
import { SearchableSelect, type SearchableSelectOption } from './searchable-select'
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
  const hasAssignee = !!currentAssignee

  // Current assignee first; SearchableSelect filters but never reorders.
  const orderedOptions = React.useMemo<SearchableSelectOption[]>(() => {
    const withAvatars = options.map(o => ({
      value: o.value,
      label: o.label,
      icon: (
        <SquareAvatar
          src={o.imageUrl}
          alt={o.label}
          fallback={o.label}
          size="sm"
          variant="round"
          className="h-6 w-6 shrink-0"
        />
      ),
    }))
    if (!currentAssignee) return withAvatars
    const current = withAvatars.find(o => o.value === currentAssignee.id)
    if (!current) return withAvatars
    return [current, ...withAvatars.filter(o => o.value !== currentAssignee.id)]
  }, [options, currentAssignee])

  const handleSelect = (userId: string) => {
    // Selecting the current assignee again unassigns.
    onAssign(currentAssignee?.id === userId ? null : userId)
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
    <SearchableSelect
      options={orderedOptions}
      value={currentAssignee?.id ?? null}
      onValueChange={handleSelect}
      searchPlaceholder="Search users..."
      emptyText="No users found"
      isLoading={isLoading}
      trigger={trigger}
      align="end"
      contentClassName="w-72"
    />
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
        <span className="truncate" title={opt.label}>{opt.label}</span>
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
                <span className="text-h4 text-ods-text-primary truncate" title={currentAssignee!.name}>{currentAssignee!.name}</span>
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
