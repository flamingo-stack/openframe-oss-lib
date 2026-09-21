'use client';

import { type MouseEvent, useCallback, useMemo, useState } from 'react';
import { cn } from '../../utils/cn';
import { PenEditIcon, UserIcon, UserPlusIcon } from '../icons-v2-generated';
import { Autocomplete, type AutocompleteOption } from './autocomplete';
import { DeletedUserAvatar } from './deleted-user-avatar';
import { SearchableSelect, type SearchableSelectOption } from './searchable-select';
import { SquareAvatar } from './square-avatar';

export interface TicketAssigneeOption {
  value: string;
  label: string;
  imageUrl?: string;
}

export interface AssigneeDropdownProps {
  currentAssignee?: {
    id: string;
    name: string;
    avatarSrc?: string;
    /** Deleted account (DELETED / SELF_DELETED) — renders the red user-x placeholder + red name. */
    deleted?: boolean;
  };
  options: TicketAssigneeOption[];
  isLoading?: boolean;
  isPending?: boolean;
  onAssign: (userId: string | null) => void;
  variant?: 'default' | 'compact';
  className?: string;
  /**
   * Intercepts the trigger: when set (compact variant), clicking the
   * avatar/assign button calls this instead of opening the dropdown — e.g. to
   * open a Take Over confirmation for tickets still worked by the AI.
   */
  onTriggerClick?: () => void;
}

export function AssigneeDropdown(props: AssigneeDropdownProps) {
  if (props.variant === 'compact') {
    return <CompactAssigneeDropdown {...props} />;
  }
  return <DefaultAssigneeDropdown {...props} />;
}

function CompactAssigneeDropdown({
  currentAssignee,
  options,
  isLoading,
  onAssign,
  className,
  onTriggerClick,
}: AssigneeDropdownProps) {
  const hasAssignee = !!currentAssignee;

  // Current assignee first; SearchableSelect filters but never reorders.
  const orderedOptions = useMemo<SearchableSelectOption[]>(() => {
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
    }));
    if (!currentAssignee) return withAvatars;
    const current = withAvatars.find(o => o.value === currentAssignee.id);
    if (!current) return withAvatars;
    return [current, ...withAvatars.filter(o => o.value !== currentAssignee.id)];
  }, [options, currentAssignee]);

  const handleSelect = (userId: string) => {
    // Selecting the current assignee again unassigns.
    onAssign(currentAssignee?.id === userId ? null : userId);
  };

  // Board cards are links: an intercepted trigger must not navigate or bubble.
  const handleTriggerClick = onTriggerClick
    ? (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        onTriggerClick();
      }
    : undefined;

  const trigger = hasAssignee ? (
    <button
      type="button"
      onClick={handleTriggerClick}
      aria-label="Change assignee"
      className={cn(
        'shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus',
        className,
      )}
    >
      {currentAssignee.deleted ? (
        <DeletedUserAvatar size="sm" accessibleLabel={`Deleted user: ${currentAssignee.name || currentAssignee.id}`} />
      ) : (
        <SquareAvatar
          src={currentAssignee.avatarSrc}
          alt={currentAssignee.name}
          fallback={currentAssignee.name || 'User'}
          size="sm"
          variant="round"
        />
      )}
    </button>
  ) : (
    <button
      type="button"
      onClick={handleTriggerClick}
      aria-label="Assign user"
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full border border-ods-border',
        'text-ods-text-secondary transition-colors hover:border-ods-accent hover:text-ods-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus',
        className,
      )}
    >
      <UserPlusIcon className="size-4" />
    </button>
  );

  // Intercepted trigger: render the plain button — no dropdown to open.
  if (onTriggerClick) return trigger;

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
  );
}

function DefaultAssigneeDropdown({ currentAssignee, options, isLoading, onAssign, className }: AssigneeDropdownProps) {
  const [isEditing, setIsEditing] = useState(false);
  const hasAssignee = !!currentAssignee;

  const renderOption = useCallback((option: AutocompleteOption) => {
    const opt = option as TicketAssigneeOption;
    return (
      <div className="flex w-full min-w-0 items-center gap-[var(--spacing-system-sf)]">
        <SquareAvatar
          src={opt.imageUrl}
          alt={opt.label}
          fallback={opt.label}
          size="sm"
          variant="round"
          className="h-6 w-6 shrink-0"
        />
        <span className="truncate" title={opt.label}>
          {opt.label}
        </span>
      </div>
    );
  }, []);

  if (isEditing) {
    return (
      <div className={cn('min-w-0', className)}>
        <Autocomplete
          options={options}
          value={currentAssignee?.id ?? null}
          onChange={val => {
            onAssign(val);
            setIsEditing(false);
          }}
          placeholder="Search users..."
          loading={isLoading}
          showChevron={false}
          startAdornment={
            hasAssignee ? (
              currentAssignee.deleted ? (
                <DeletedUserAvatar
                  size="sm"
                  className="h-6 w-6"
                  accessibleLabel={`Deleted user: ${currentAssignee.name || currentAssignee.id}`}
                />
              ) : (
                <SquareAvatar
                  src={currentAssignee.avatarSrc}
                  alt={currentAssignee.name}
                  fallback={currentAssignee.name || 'User'}
                  size="sm"
                  variant="round"
                  className="h-6 w-6"
                />
              )
            ) : (
              <UserIcon className="size-5 text-ods-text-secondary" />
            )
          }
          renderOption={renderOption}
        />
        <span className="mt-0.5 block truncate text-ods-text-secondary text-h6">Assigned</span>
      </div>
    );
  }

  if (hasAssignee) {
    return (
      <div className={cn('flex min-w-0 items-center gap-[var(--spacing-system-xs)]', className)}>
        {currentAssignee.deleted ? (
          <DeletedUserAvatar
            size="md"
            accessibleLabel={`Deleted user: ${currentAssignee.name || currentAssignee.id}`}
          />
        ) : (
          <SquareAvatar
            src={currentAssignee.avatarSrc}
            alt={currentAssignee.name}
            fallback={currentAssignee.name || 'User'}
            size="md"
            variant="round"
            className="shrink-0"
          />
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex flex-col justify-center">
            <div className="flex w-full min-w-0 items-center gap-[var(--spacing-system-xxs)]">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="group flex cursor-pointer items-center gap-[var(--spacing-system-xxs)] text-left"
              >
                <PenEditIcon className="size-4 shrink-0 text-ods-text-secondary transition-colors group-hover:text-ods-accent" />
                <span
                  className={cn(
                    'truncate text-h4',
                    currentAssignee.deleted ? 'text-ods-error' : 'text-ods-text-primary',
                  )}
                  title={currentAssignee.name}
                >
                  {currentAssignee.name}
                </span>
              </button>
            </div>
            <span className="truncate text-ods-text-secondary text-h6">Assigned</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('min-w-0', className)}>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="flex cursor-pointer items-center gap-[var(--spacing-system-xxs)] truncate text-left text-ods-accent underline transition-opacity text-h4 hover:opacity-80"
      >
        <UserIcon className="size-4 shrink-0" />
        <span>Assign User</span>
      </button>
      <span className="block truncate text-ods-text-secondary text-h6">Assigned</span>
    </div>
  );
}
