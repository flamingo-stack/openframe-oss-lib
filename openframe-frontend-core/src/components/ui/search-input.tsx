'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import {
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAutoLimitTags } from '../../hooks/ui/use-auto-limit-tags';
import { useDebounce } from '../../hooks/ui/use-debounce';
import { useIsomorphicLayoutEffect } from '../../hooks/ui/use-isomorphic-layout-effect';
import { useKeyboardCollisionPadding } from '../../hooks/ui/use-keyboard-collision-padding';
import { cn } from '../../utils/cn';
import { SearchIcon } from '../icons-v2-generated';
import { XmarkCircleIcon } from '../icons-v2-generated/signs-and-symbols/xmark-circle-icon';
import { HiddenTagsPopup } from './hidden-tags-popup';
import { Tag } from './tag';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  path?: string;
  type?: string;
  icon?: ReactNode;
  metadata?: Record<string, unknown>;
}

export interface FilterChipData {
  id: string;
  label: string;
  variant?: 'selected' | 'category' | 'subcategory' | 'tag';
}

export interface SearchInputProps {
  /** Placeholder text shown in the input */
  placeholder?: string;
  /** Controlled value */
  value?: string;
  /** Default value for uncontrolled mode */
  defaultValue?: string;
  /** Called when input value changes (raw, not debounced) */
  onChange?: (value: string) => void;
  /** Called when user presses Enter */
  onSubmit?: (value: string) => void;
  /** Search results to display in the dropdown */
  results?: SearchResult[];
  /** Whether results are loading */
  isLoading?: boolean;
  /** Called when a result row is selected.
   *
   *  `modifiers` carries the click event's modifier-key state when the
   *  user picked the row via mouse — pass through so the consumer can
   *  honor cmd/ctrl/shift/middle-click for background-tab navigation
   *  (the row is a `<div role="option">` rather than an `<a>`, so the
   *  browser doesn't background-tab natively even with `target="_blank"`).
   *  Empty `{}` when the row was selected via keyboard Enter. */
  onResultSelect?: (
    result: SearchResult,
    modifiers?: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; button?: number },
  ) => void;
  /** Debounce delay in ms. 0 disables debounce. Default 300 */
  debounceMs?: number;
  /** Custom renderer for a single result row */
  renderResult?: (result: SearchResult, isHighlighted: boolean) => ReactNode;
  /** Group results by a key derived from each result */
  groupBy?: (result: SearchResult) => string;
  /** Text shown when query meets minQueryLength but no results */
  emptyResultsText?: string;
  /** Force-control dropdown visibility. Default: auto */
  showDropdown?: boolean;
  /** Filter chips rendered inline before the input */
  filterChips?: FilterChipData[];
  /** Called when a filter chip is removed */
  onFilterRemove?: (id: string) => void;
  /** Element rendered before the input. Default: SearchIcon */
  startAdornment?: ReactNode;
  /** Element rendered after the input */
  endAdornment?: ReactNode;
  /** Extra class names for the outer container */
  className?: string;
  /** Extra class names for the dropdown */
  dropdownClassName?: string;
  /** Minimum characters before showing results. Default 2 */
  minQueryLength?: number;
  /** Maximum visible filter chips. "auto" measures available width. Default "auto" */
  limitTags?: number | 'auto';
  /** Custom render for the "+N" overflow text */
  getLimitTagsText?: (more: number) => ReactNode;
}

// ---------------------------------------------------------------------------
// Shared styles (consistent with Autocomplete / Input)
// ---------------------------------------------------------------------------

const containerStyles = cn(
  // Layout & spacing — matches lib Input component
  'flex h-11 cursor-text items-center gap-2 rounded-[6px] border px-3 md:h-12',
  'has-[:focus-visible]:outline-none',
  'group',
  'transition-colors duration-200',
  // Theme palette — matches lib Input component
  'border-ods-border bg-ods-card has-[:focus]:border-ods-accent',
);

const innerInputStyles = cn(
  'min-w-[60px] flex-1 border-none bg-transparent outline-none',
  'text-h4',
  'text-ods-text-primary placeholder:text-ods-text-secondary',
  // Disabled - match Input exactly (value greys out, placeholder dims further)
  'disabled:cursor-not-allowed disabled:text-ods-text-disabled disabled:placeholder:text-ods-border',
  'touch-manipulation',
);

// ---------------------------------------------------------------------------
// Helper: chip variant → Tag variant mapping
// ---------------------------------------------------------------------------

function chipVariantToTagVariant(variant?: FilterChipData['variant']): 'primary' | 'outline' | 'badge' {
  switch (variant) {
    case 'selected':
      return 'primary';
    // Content tags render with the unified badge skin (ods-card + ods-border,
    // mono uppercase) — identical to the public EntityTagBadges display.
    case 'tag':
      return 'badge';
    case 'category':
    case 'subcategory':
    default:
      return 'outline';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchInput({
  placeholder = 'Search...',
  value,
  defaultValue = '',
  onChange,
  onSubmit,
  results = [],
  isLoading = false,
  onResultSelect,
  debounceMs = 300,
  renderResult,
  groupBy,
  emptyResultsText = 'No results found',
  showDropdown: showDropdownProp,
  filterChips = [],
  onFilterRemove,
  startAdornment,
  endAdornment,
  className,
  dropdownClassName,
  minQueryLength = 2,
  limitTags = 'auto',
  getLimitTagsText = (more: number) => `+${more}`,
}: SearchInputProps) {
  // ---- Controlled / uncontrolled ----
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = onChange ? (value ?? '') : internalValue;

  // ---- Debounce ----
  const debouncedValue = useDebounce(currentValue, debounceMs);

  // ---- Popover state ----
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const keyboardPadding = useKeyboardCollisionPadding();

  const containerRef = useRef<HTMLDivElement>(null);

  // ---- Auto-limit tags ----
  const currentPlaceholder = filterChips.length > 0 ? 'Add filter...' : placeholder;

  const {
    visibleCount: rawVisibleCount,
    middleRef,
    measureRef,
    textMeasureRef,
    badgeRef,
    inputRef,
  } = useAutoLimitTags({
    count: filterChips.length,
    limitTags,
    // When chips exist, pass empty placeholder so the hook only reserves input minWidth,
    // not the full placeholder text width — gives more room for chips on narrow screens
    placeholder: filterChips.length > 0 ? '' : placeholder,
  });

  // Always show at least 1 chip when chips exist (industry standard: Gmail, MUI, Ant Design)
  const visibleCount = filterChips.length > 0 ? Math.max(1, rawVisibleCount) : rawVisibleCount;

  // ---- Hidden tags popup ----
  const hiddenTagsRef = useRef<HTMLDivElement>(null);
  const hiddenTagsPopupRef = useRef<HTMLDivElement>(null);
  const [showHiddenTags, setShowHiddenTags] = useState(false);

  useEffect(() => {
    if (!showHiddenTags) return undefined;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!hiddenTagsRef.current?.contains(target) && !hiddenTagsPopupRef.current?.contains(target)) {
        setShowHiddenTags(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showHiddenTags]);

  // The popup is rendered OUTSIDE the overflow-hidden chip row, so it has to be
  // pushed across to sit under the `+N` badge. Measured in a layout effect
  // rather than during render: `getBoundingClientRect()` is a value React does
  // not track, so a render-time read pinned the popup to wherever the badge
  // happened to be at that one render and never followed it afterwards —
  // removing a chip from the popup shifts the badge left, and the popup stayed
  // behind. Unconditional so every commit re-measures; it runs before paint,
  // so there is no visible jump.
  useIsomorphicLayoutEffect(() => {
    const popup = hiddenTagsPopupRef.current;
    const badge = badgeRef.current;
    if (!popup || !badge) return;
    const originLeft = containerRef.current?.getBoundingClientRect().left ?? 0;
    popup.style.left = `${badge.getBoundingClientRect().left - originLeft}px`;
  });

  // ---- Derived chip slicing ----
  const hiddenCount = filterChips.length - visibleCount;
  const visibleChips = filterChips.slice(0, visibleCount);
  const hiddenChips = filterChips.slice(visibleCount);

  // ---- Derive flat list (possibly grouped) ----
  const { flatResults, groups } = useMemo(() => {
    if (!groupBy) return { flatResults: results, groups: null };

    const grouped = new Map<string, SearchResult[]>();
    for (const r of results) {
      const key = groupBy(r);
      const arr = grouped.get(key);
      if (arr) {
        arr.push(r);
      } else {
        grouped.set(key, [r]);
      }
    }
    return { flatResults: results, groups: grouped };
  }, [results, groupBy]);

  // ---- Auto-show logic ----
  const meetsMinQuery = debouncedValue.length >= minQueryLength;
  const autoShow = meetsMinQuery;
  const dropdownVisible = showDropdownProp ?? (isOpen && autoShow);

  // ---- Reset highlight when results change ----
  // Adjusted while rendering, not from an effect: the highlight is drawn from
  // this value in THIS render, so an effect commits one frame highlighting
  // whatever result now happens to sit at the old index — and Enter pressed in
  // that frame navigates to it.
  const [highlightedFor, setHighlightedFor] = useState(flatResults.length);
  if (highlightedFor !== flatResults.length) {
    setHighlightedFor(flatResults.length);
    setHighlightedIndex(-1);
  }

  // ---- Handlers ----
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    if (onChange) {
      onChange(newVal);
    } else {
      setInternalValue(newVal);
    }
    if (!isOpen) setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleClear = (e: ReactMouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onChange) {
      onChange('');
    } else {
      setInternalValue('');
    }
    inputRef.current?.focus();
  };

  const handleResultClick = (result: SearchResult, e?: ReactMouseEvent) => {
    onResultSelect?.(
      result,
      e
        ? {
            metaKey: e.metaKey,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            button: e.button,
          }
        : undefined,
    );
    setIsOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) setIsOpen(true);
        setHighlightedIndex(prev => (prev < flatResults.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : flatResults.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && flatResults[highlightedIndex]) {
          handleResultClick(flatResults[highlightedIndex]);
        } else {
          onSubmit?.(currentValue);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case 'Backspace':
        if (!currentValue && filterChips.length > 0 && onFilterRemove) {
          onFilterRemove(filterChips[filterChips.length - 1].id);
        }
        break;
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  // ---- Default result renderer ----
  const defaultRenderResult = (result: SearchResult, isHighlighted: boolean) => (
    <div className="flex w-full min-w-0 items-center gap-3">
      {result.icon && <span className="flex-shrink-0 text-ods-text-secondary [&_svg]:size-4">{result.icon}</span>}
      <div className="min-w-0 flex-1">
        <div
          className={cn('truncate text-h6', isHighlighted ? 'text-ods-accent' : 'text-ods-text-primary')}
          title={result.title}
        >
          {result.title}
        </div>
        {result.description && (
          <div className="mt-0.5 truncate text-ods-text-secondary text-h6" title={result.description}>
            {result.description}
          </div>
        )}
      </div>
      {result.type && <span className="flex-shrink-0 uppercase text-ods-text-muted text-h6">{result.type}</span>}
    </div>
  );

  // ---- Render a result row ----
  const renderRow = (result: SearchResult, index: number) => {
    const isHighlighted = index === highlightedIndex;
    return (
      <div
        key={result.id}
        role="option"
        aria-selected={isHighlighted}
        className={cn(
          'flex min-h-10 cursor-pointer items-center border-b border-ods-border px-3 transition-colors last:border-b-0',
          isHighlighted && 'bg-ods-bg-hover',
          !isHighlighted && 'hover:bg-ods-bg-hover',
        )}
        onClick={e => handleResultClick(result, e)}
        onMouseEnter={() => setHighlightedIndex(index)}
      >
        {renderResult ? renderResult(result, isHighlighted) : defaultRenderResult(result, isHighlighted)}
      </div>
    );
  };

  // ---- Dropdown content ----
  const renderDropdownContent = () => {
    if (isLoading) {
      return <div className="px-4 py-3 text-ods-text-secondary text-h6">Loading...</div>;
    }

    if (flatResults.length === 0) {
      return <div className="px-4 py-3 text-ods-text-secondary text-h6">{emptyResultsText}</div>;
    }

    if (groups) {
      let globalIndex = 0;
      return Array.from(groups.entries()).map(([groupLabel, groupResults]) => (
        <div key={groupLabel}>
          <div className="bg-ods-bg px-4 py-2 font-semibold uppercase text-ods-text-secondary text-h6">
            {groupLabel}
          </div>
          {groupResults.map(result => {
            const idx = globalIndex++;
            return renderRow(result, idx);
          })}
        </div>
      ));
    }

    return flatResults.map((result, index) => renderRow(result, index));
  };

  // ---- Determine if we have a value worth clearing ----
  const hasValue = currentValue.length > 0;

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <PopoverPrimitive.Root open={dropdownVisible} onOpenChange={handleOpenChange} modal={false}>
        <PopoverPrimitive.Anchor asChild>
          <div
            className={cn(
              containerStyles,
              'hover:border-ods-border-hover hover:bg-ods-bg-hover active:border-ods-border-active active:bg-ods-bg-active',
              dropdownVisible && '!border-ods-accent',
            )}
            onClick={() => {
              inputRef.current?.focus();
              setIsOpen(true);
            }}
          >
            {/* Start Adornment — pinned left, shrink-0 */}
            <span className="flex-shrink-0 text-ods-text-secondary transition-colors duration-200 group-has-[:focus]:text-ods-accent [&_svg]:size-4 md:[&_svg]:size-6">
              {startAdornment !== undefined ? startAdornment : <SearchIcon />}
            </span>

            {/* Middle zone: chips + input — overflow hidden, single line */}
            <div ref={middleRef} className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
              {/* Visible filter chips */}
              {visibleChips.map(chip => (
                <Tag
                  key={chip.id}
                  variant={chipVariantToTagVariant(chip.variant)}
                  label={chip.label}
                  labelClassName="max-w-[120px] truncate"
                  onClose={onFilterRemove ? () => onFilterRemove(chip.id) : undefined}
                />
              ))}

              {/* "+N" overflow badge */}
              {hiddenCount > 0 && (
                <div ref={hiddenTagsRef} className="shrink-0">
                  <button
                    ref={badgeRef}
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setShowHiddenTags(prev => !prev);
                    }}
                    className={cn(
                      'flex h-8 items-center px-2',
                      'rounded-[6px] border border-ods-border bg-ods-card',
                      'text-ods-text-secondary text-h5',
                      'cursor-pointer transition-colors hover:bg-ods-bg-hover',
                    )}
                    aria-label={`${hiddenCount} more selected filters`}
                  >
                    {getLimitTagsText(hiddenCount)}
                  </button>
                </div>
              )}

              {/* Input */}
              <input
                ref={inputRef}
                type="text"
                value={currentValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  setIsOpen(true);
                  setShowHiddenTags(false);
                }}
                placeholder={currentPlaceholder}
                className={innerInputStyles}
              />
            </div>

            {/* End adornment / Clear — pinned right, shrink-0 */}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {hasValue && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center justify-center transition-opacity hover:opacity-70"
                  aria-label="Clear search"
                >
                  <XmarkCircleIcon className="text-ods-text-secondary" size={24} />
                </button>
              )}
              {endAdornment}
            </div>
          </div>
        </PopoverPrimitive.Anchor>

        <PopoverPrimitive.Content
          className={cn(
            'z-50 mt-1 w-[var(--radix-popover-trigger-width)]',
            'overflow-hidden rounded-[6px] border border-ods-border bg-ods-card shadow-lg',
            'flex max-h-[var(--radix-popper-available-height)] flex-col',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
            dropdownClassName,
          )}
          sideOffset={4}
          align="start"
          // The anchor is the search field that raises the software keyboard,
          // so these suggestions are always positioned with the keyboard up —
          // see useKeyboardCollisionPadding.
          collisionPadding={{ bottom: keyboardPadding }}
          onOpenAutoFocus={e => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          onInteractOutside={e => {
            if (containerRef.current?.contains(e.target as Node)) {
              e.preventDefault();
            }
          }}
        >
          <ScrollAreaPrimitive.Root className="flex min-h-0 flex-col overflow-hidden">
            <ScrollAreaPrimitive.Viewport className="max-h-[320px] min-h-0 w-full">
              <div role="listbox">{renderDropdownContent()}</div>
            </ScrollAreaPrimitive.Viewport>
            <ScrollAreaPrimitive.Scrollbar className="hidden" orientation="vertical">
              <ScrollAreaPrimitive.Thumb />
            </ScrollAreaPrimitive.Scrollbar>
          </ScrollAreaPrimitive.Root>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Root>

      {/* Hidden tags popup — outside overflow-hidden, positioned under badge */}
      {showHiddenTags && hiddenCount > 0 && (
        <HiddenTagsPopup
          ref={hiddenTagsPopupRef}
          items={hiddenChips.map(chip => ({ label: chip.label, value: chip.id }))}
          onRemove={removedTag => {
            onFilterRemove?.(removedTag as string);
            if (hiddenCount <= 1) setShowHiddenTags(false);
          }}
        />
      )}

      {/* Off-screen measurement: placeholder text width — fixed positioning avoids scroll contribution */}
      <span
        ref={textMeasureRef}
        aria-hidden="true"
        className="pointer-events-none fixed -left-[9999px] top-0 whitespace-nowrap text-ods-text-primary"
      >
        {currentPlaceholder}
      </span>

      {/* Off-screen measurement: all chip widths */}
      <div ref={measureRef} aria-hidden="true" className="pointer-events-none fixed -left-[9999px] top-0 flex gap-2">
        {filterChips.map(chip => (
          <Tag
            key={`m-${chip.id}`}
            variant={chipVariantToTagVariant(chip.variant)}
            label={chip.label}
            labelClassName="max-w-[120px] truncate"
            onClose={() => {}}
          />
        ))}
      </div>
    </div>
  );
}

export default SearchInput;
