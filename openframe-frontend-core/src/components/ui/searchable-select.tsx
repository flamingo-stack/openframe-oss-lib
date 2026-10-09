'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { type ReactNode, useMemo, useState } from 'react';
import { useKeyboardCollisionPadding } from '../../hooks/ui/use-keyboard-collision-padding';
import { cn } from '../../utils/cn';
import { CheckIcon, SearchIcon } from '../icons-v2-generated';
import { Chevron02DownIcon } from '../icons-v2-generated/arrows/chevron-02-down-icon';
import { FieldWrapper } from './field-wrapper';
import { Input } from './input';

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Optional leading visual for the option row (avatar, icon, badge). The
   *  default trigger leads with the selected option's icon too. */
  icon?: ReactNode;
  /** Extra terms the search matches besides `label` — e.g. the stored key of a
   *  glyph (`chart-pie`) whose label reads "Pie chart". */
  keywords?: string[];
}

/** How the dropdown lays its options out — see `SearchableSelectProps.layout`. */
export type SearchableSelectLayout = 'list' | 'grid';

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  /** Currently selected option value; null/undefined when nothing is selected. */
  value?: string | null;
  onValueChange: (value: string) => void;
  /** Default trigger text while nothing is selected. */
  placeholder?: string;
  /** Placeholder of the search input rendered as the first dropdown item. */
  searchPlaceholder?: string;
  emptyText?: string;
  loadingText?: string;
  isLoading?: boolean;
  disabled?: boolean;
  /**
   * Custom trigger node (rendered via Popover.Trigger asChild). When omitted,
   * a select-like button (Input/SelectTrigger styling, chevron, placeholder)
   * is rendered.
   */
  trigger?: ReactNode;
  /**
   * Label above the default trigger — the same `FieldWrapper` treatment
   * `SelectTrigger` gives its `label`, so a searchable field lines up with the
   * plain selects beside it. A custom `trigger` owns its own label.
   */
  label?: string;
  /** Label scale forwarded to FieldWrapper ('large' = text-h4 for designs with body-scale field titles). */
  labelVariant?: 'default' | 'large';
  /** Validation message under the default trigger; also paints its border red. */
  error?: string;
  /**
   * `'list'` (default) stacks full-width rows. `'grid'` tiles the options —
   * icon above a centered caption, `minmax(7rem, 1fr)` columns — the
   * icon-picker pattern. The grid fills the popover, so size it through
   * `contentClassName` (360px fits three tiles).
   */
  layout?: SearchableSelectLayout;
  /** Custom option-row renderer; default is icon + label + selected check
   *  (icon above the caption in the grid layout). */
  renderOption?: (option: SearchableSelectOption, isSelected: boolean) => ReactNode;
  align?: 'start' | 'center' | 'end';
  /** Classes for the default trigger button. */
  className?: string;
  /** Classes for the popover content (e.g. a fixed width for icon triggers). */
  contentClassName?: string;
}

/**
 * Select-style dropdown whose first item is a search field filtering the
 * option list — the pattern used by the ticket assignee picker ("Search
 * users...") generalized for any entity (devices, users, ...). Provide a
 * custom `trigger` for icon-button use cases; the default trigger looks and
 * behaves like `SelectTrigger`.
 */
export function SearchableSelect(allProps: SearchableSelectProps) {
  const {
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
    label,
    labelVariant,
    error,
    layout = 'list',
    renderOption,
    align = 'start',
    className,
    contentClassName,
  } = allProps;
  // Wired for a message even while `error` is undefined — see `FieldWrapper.errorSlot`.
  const errorSlot = 'error' in allProps;
  const isInvalid = !!error;
  const isGrid = layout === 'grid';

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const keyboardPadding = useKeyboardCollisionPadding();

  // Clear the query on close, while rendering rather than from an effect: the
  // popover closes and reopens without unmounting, so an effect left the
  // previous query in the field for the frame the popover reopened in. Guarded
  // on `search`, so the extra render pass this schedules takes the early exit.
  if (!isOpen && search !== '') setSearch('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      o => o.label.toLowerCase().includes(q) || (o.keywords ?? []).some(k => k.toLowerCase().includes(q)),
    );
  }, [options, search]);

  const selectedOption = useMemo(
    () => (value != null ? options.find(o => o.value === value) : undefined),
    [options, value],
  );

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setIsOpen(false);
  };

  const defaultTrigger = (
    <button
      type="button"
      disabled={disabled}
      data-invalid={isInvalid || undefined}
      className={cn(
        // Mirrors SelectTrigger so the closed state is indistinguishable from
        // the regular Select.
        'flex h-11 w-full items-center justify-between gap-2 rounded-md border px-3 text-left outline-none md:h-12',
        'border-ods-border bg-ods-card text-h4',
        selectedOption ? 'text-ods-text-primary' : 'text-ods-text-secondary',
        'enabled:hover:border-ods-border-hover enabled:hover:bg-ods-bg-hover enabled:active:border-ods-border-active enabled:active:bg-ods-bg-active',
        !isInvalid && 'data-[state=open]:border-ods-accent data-[state=open]:hover:border-ods-accent',
        'group cursor-pointer transition-colors duration-200 disabled:!cursor-not-allowed disabled:bg-ods-bg',
        isInvalid &&
          'border-ods-error enabled:hover:border-ods-error enabled:active:border-ods-error data-[state=open]:border-ods-error',
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {selectedOption?.icon}
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
      </span>
      <Chevron02DownIcon
        className={cn(
          'shrink-0 text-ods-text-secondary transition-all duration-200 group-data-[state=open]:rotate-180',
          isInvalid ? 'text-ods-error' : 'group-data-[state=open]:text-ods-accent',
        )}
        size={24}
      />
    </button>
  );

  const triggerElement = <PopoverPrimitive.Trigger asChild>{trigger ?? defaultTrigger}</PopoverPrimitive.Trigger>;

  // A `role="listbox"` child that is a status line, not an option: in the grid
  // it has to span the row or it would sit in one tile-sized cell.
  const statusClass = cn(
    'px-[var(--spacing-system-sf)] py-[var(--spacing-system-s)] text-ods-text-secondary text-h5',
    isGrid && 'col-span-full',
  );

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={disabled ? undefined : setIsOpen} modal={false}>
      {!trigger && (label !== undefined || errorSlot) ? (
        <FieldWrapper label={label} labelVariant={labelVariant} error={error} errorSlot={errorSlot}>
          {triggerElement}
        </FieldWrapper>
      ) : (
        triggerElement
      )}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={6}
          // The search field below raises the software keyboard the moment this
          // opens — see useKeyboardCollisionPadding for why neither the collision
          // viewport nor the available height knows about it otherwise.
          collisionPadding={{ bottom: keyboardPadding }}
          className={cn(
            'z-50 min-w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-ods-border bg-ods-card shadow-lg',
            'flex max-h-[var(--radix-popper-available-height)] flex-col',
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
          <div
            className={cn(
              'max-h-80 min-h-0 overflow-y-auto',
              // Tiles grow from 7rem: the popover's own border and a classic
              // always-on scrollbar both eat into the track, so 7.5rem (the
              // Figma cell) dropped a 360px popover to two columns. The column
              // count follows the popover width. Each tile draws its own
              // bottom/right rule, so the grid needs no gap.
              isGrid ? 'grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]' : 'py-[var(--spacing-system-xs)]',
            )}
            role="listbox"
          >
            {isLoading ? (
              <div className={statusClass}>{loadingText}</div>
            ) : filtered.length === 0 ? (
              <div className={statusClass}>{emptyText}</div>
            ) : (
              filtered.map(opt => {
                const isSelected = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      'transition-colors hover:bg-ods-bg-hover',
                      isGrid
                        ? 'flex min-w-0 flex-col items-center justify-center gap-[var(--spacing-system-xxs)] border-b border-r border-ods-border p-[var(--spacing-system-xs)]'
                        : 'flex w-full items-center gap-[var(--spacing-system-xs)] px-[var(--spacing-system-sf)] py-[var(--spacing-system-xs)] text-left',
                      isSelected && 'bg-ods-bg-hover',
                    )}
                  >
                    {renderOption ? (
                      renderOption(opt, isSelected)
                    ) : isGrid ? (
                      <>
                        {opt.icon}
                        <span
                          className={cn(
                            'w-full truncate text-center text-h6',
                            isSelected ? 'text-ods-text-primary' : 'text-ods-text-secondary',
                          )}
                          title={opt.label}
                        >
                          {opt.label}
                        </span>
                      </>
                    ) : (
                      <>
                        {opt.icon}
                        <span className="flex-1 truncate text-ods-text-primary text-h4" title={opt.label}>
                          {opt.label}
                        </span>
                        {isSelected && <CheckIcon className="size-4 shrink-0 text-ods-accent" />}
                      </>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
