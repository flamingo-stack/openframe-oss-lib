'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { Loader2 } from 'lucide-react';
import {
  type ChangeEvent,
  type ForwardedRef,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAutoLimitTags } from '../../hooks/ui/use-auto-limit-tags';
import { useKeyboardCollisionPadding } from '../../hooks/ui/use-keyboard-collision-padding';
import { cn } from '../../utils/cn';
import { Chevron02DownIcon } from '../icons-v2-generated/arrows/chevron-02-down-icon';
import { TrashIcon } from '../icons-v2-generated/interface/trash-icon';
import { CheckIcon } from '../icons-v2-generated/signs-and-symbols/check-icon';
import { XmarkCircleIcon } from '../icons-v2-generated/signs-and-symbols/xmark-circle-icon';
import { FieldWrapper } from './field-wrapper';
import { HiddenTagsPopup } from './hidden-tags-popup';
import { Tag } from './tag';
import { TruncateText } from './truncate-text';

export interface AutocompleteOption<T = string> {
  label: string;
  value: T;
}

export type AutocompleteInputChangeReason = 'input' | 'reset' | 'clear';

interface AutocompleteBaseProps<T = string> {
  /** Available options to select from */
  options: AutocompleteOption<T>[];
  /** Placeholder text */
  placeholder?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Element displayed at the start of the input */
  startAdornment?: ReactNode;
  /** Whether to show clear button */
  showClearAll?: boolean;
  /** Custom className for the container */
  className?: string;
  /** Custom className for the dropdown */
  dropdownClassName?: string;
  /** When true, allows creating new options by typing */
  freeSolo?: boolean;
  /** Label for the input */
  label?: string;
  /** Error message displayed below the field */
  error?: string;
  /** Custom filter function */
  filterOptions?: (options: AutocompleteOption<T>[], inputValue: string) => AutocompleteOption<T>[];
  /** Render custom option content */
  renderOption?: (option: AutocompleteOption<T>, isSelected: boolean) => ReactNode;
  /** When true, shows validation error styling */
  invalid?: boolean;
  /** No options text */
  noOptionsText?: string;
  /** Controlled input value. When provided, the component won't manage input state internally. */
  inputValue?: string;
  /** Callback when input value changes (typing, selection, clearing). Fires in both controlled and uncontrolled modes. */
  onInputChange?: (value: string, reason: AutocompleteInputChangeReason) => void;
  /** Loading state */
  loading?: boolean;
  /** Loading text */
  loadingText?: string;
  /** When true, shows a clickable "+ Create" option when no results match the input */
  creatable?: boolean;
  /** Callback fired after a new option is created via creatable. Use it to persist the new option server-side, etc. */
  onCreateOption?: (inputValue: string) => void;
  /** Max length for a created option. When exceeded, creation is blocked and a hint is shown. Omit for no limit. */
  maxCreateLength?: number;
  /** When set, each unselected option shows a hover trash button that calls this. Omit to hide delete. */
  onDeleteOption?: (value: T) => void;
  isDeletingOption?: boolean;
  /** When true, disables built-in client-side filtering (useful when options are filtered server-side via onInputChange) */
  disableClientFilter?: boolean;
  /** Whether to show the chevron icon. Default true */
  showChevron?: boolean;
  /** Whether to clear the input when the dropdown opens (single mode only). Default true */
  clearOnOpen?: boolean;
}

export interface AutocompleteSingleProps<T = string> extends AutocompleteBaseProps<T> {
  /** Single-select mode (default) */
  multiple?: false;
  /** Currently selected value */
  value: T | null;
  /** Callback when selection changes */
  onChange: (value: T | null) => void;
}

export interface AutocompleteMultipleProps<T = string> extends AutocompleteBaseProps<T> {
  /** Enable multi-select mode */
  multiple: true;
  /** Currently selected values */
  value: T[];
  /** Callback when selection changes */
  onChange: (value: T[]) => void;
  /** Maximum number of items that can be selected */
  maxItems?: number;
  /** Render custom tag content */
  renderTag?: (option: AutocompleteOption<T>) => ReactNode;
  /** Maximum number of visible tags. Set to "auto" for automatic calculation based on available width. Default "auto" */
  limitTags?: number | 'auto';
  /** Custom render function for the "+N" overflow chip */
  getLimitTagsText?: (more: number) => ReactNode;
}

export type AutocompleteProps<T = string> = AutocompleteSingleProps<T> | AutocompleteMultipleProps<T>;

// Inner input styles matching Input component
const innerInputStyles = cn(
  'min-w-[60px] flex-1 border-none bg-transparent outline-none',
  'text-h4',
  'text-ods-text-primary placeholder:text-ods-text-secondary',
  // Disabled - match Input exactly (value greys out, placeholder dims further)
  'disabled:cursor-not-allowed disabled:text-ods-text-disabled disabled:placeholder:text-ods-border',
);

function AutocompleteInner<T = string>(props: AutocompleteProps<T>, ref: ForwardedRef<HTMLDivElement>) {
  const {
    options,
    disabled = false,
    startAdornment,
    showClearAll = true,
    className,
    dropdownClassName,
    freeSolo = false,
    label,
    error,
    filterOptions,
    renderOption,
    invalid = false,
    noOptionsText = 'No options',
    inputValue: inputValueProp,
    onInputChange,
    loading = false,
    loadingText = 'Loading...',
    creatable = false,
    onCreateOption,
    maxCreateLength,
    onDeleteOption,
    isDeletingOption = false,
    disableClientFilter = false,
    showChevron = true,
    clearOnOpen = true,
  } = props;

  const multiple = props.multiple ?? false;
  const placeholder = props.placeholder ?? (multiple ? 'Add More...' : 'Select...');

  // Multiple-only props
  const maxItems = multiple ? (props as AutocompleteMultipleProps<T>).maxItems : undefined;
  const renderTag = multiple ? (props as AutocompleteMultipleProps<T>).renderTag : undefined;
  const limitTagsProp = multiple ? ((props as AutocompleteMultipleProps<T>).limitTags ?? 'auto') : 'auto';
  const getLimitTagsText = multiple
    ? ((props as AutocompleteMultipleProps<T>).getLimitTagsText ?? ((more: number) => `+${more}`))
    : (more: number) => `+${more}`;

  // Normalize value to array for internal use. Memoised: the single-value and
  // empty branches both minted a new array on every render, so the memo keyed
  // on this never hit.
  const valueArray: T[] = useMemo(
    () => (multiple ? (props.value as T[]) : props.value != null ? [props.value as T] : []),
    [multiple, props.value],
  );

  const [internalInputValue, setInternalInputValue] = useState('');
  const isInputControlled = inputValueProp !== undefined;
  const inputValue = isInputControlled ? inputValueProp : internalInputValue;

  const updateInputValue = (value: string, reason: AutocompleteInputChangeReason) => {
    if (!isInputControlled) {
      setInternalInputValue(value);
    }
    onInputChange?.(value, reason);
  };

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const keyboardPadding = useKeyboardCollisionPadding();
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenTagsPopupRef = useRef<HTMLDivElement>(null);

  const isInvalid = invalid || !!error;

  // Combine refs
  useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

  // Get selected options
  const selectedOptions = useMemo(() => {
    return valueArray.map(v => options.find(opt => opt.value === v) ?? { label: String(v), value: v });
  }, [valueArray, options]);

  // Single mode: the currently selected option
  const selectedOption = !multiple && selectedOptions.length > 0 ? selectedOptions[0] : null;

  // Placeholder logic
  const inputPlaceholder = multiple ? (valueArray.length === 0 ? placeholder : 'Add More...') : placeholder;

  // ---- Auto limit tags via shared hook ----
  // Destructured rather than kept as `autoLimitTags.<x>Ref`: reaching through
  // the object in JSX reads the property on every render, which is a ref
  // access in render even though the ref object itself is only being handed to
  // React. Pulling them out once is what the other consumers of this hook do.
  const {
    visibleCount: autoVisibleCount,
    middleRef,
    measureRef,
    textMeasureRef,
    badgeRef,
    inputRef,
  } = useAutoLimitTags({
    count: multiple ? selectedOptions.length : 0,
    limitTags: multiple ? limitTagsProp : 0,
    placeholder: inputPlaceholder,
  });

  const visibleCount = multiple ? autoVisibleCount : 0;
  const visibleTags = multiple ? selectedOptions.slice(0, visibleCount) : [];
  const hiddenTags = multiple ? selectedOptions.slice(visibleCount) : [];
  const hiddenTagsCount = multiple ? selectedOptions.length - visibleCount : 0;

  const [showHiddenTags, setShowHiddenTags] = useState(false);
  const hiddenTagsRef = useRef<HTMLDivElement>(null);

  // Close hidden tags list on outside click
  useEffect(() => {
    if (!showHiddenTags) return undefined;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inButton = hiddenTagsRef.current?.contains(target);
      const inPopup = hiddenTagsPopupRef.current?.contains(target);
      if (!inButton && !inPopup) {
        setShowHiddenTags(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showHiddenTags]);

  // Synchronously open dropdown, pre-filling input when clearOnOpen is false
  const openDropdown = () => {
    if (!multiple && !clearOnOpen && selectedOption) {
      updateInputValue(selectedOption.label, 'reset');
    }
    setShowHiddenTags(false);
    setIsOpen(true);
  };

  // Input display value:
  // - Single mode, closed, has selection → show selected label
  // - Single mode, open, clearOnOpen=false → show inputValue (pre-filled with label)
  // - Otherwise → show inputValue (what user is typing)
  const inputDisplayValue = !multiple && !isOpen && selectedOption ? selectedOption.label : inputValue;

  // Filter options based on inputValue
  const filteredOptions = useMemo(() => {
    if (disableClientFilter) {
      return options;
    }

    if (filterOptions) {
      return filterOptions(options, inputValue);
    }

    if (!inputValue.trim()) {
      return options;
    }

    const lowerInput = inputValue.toLowerCase();
    return options.filter(opt => opt.label.toLowerCase().includes(lowerInput));
  }, [options, inputValue, filterOptions, disableClientFilter]);

  // Show "+ Create" option when creatable is on, user typed something, and nothing matched
  const showCreateOption = creatable && inputValue.trim().length > 0 && filteredOptions.length === 0;
  const isCreateTooLong = maxCreateLength != null && inputValue.trim().length > maxCreateLength;

  // Handle creating a new option
  const handleCreate = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || (maxCreateLength != null && trimmed.length > maxCreateLength)) return;

    const newValue = trimmed as T;

    if (multiple) {
      if (maxItems && valueArray.length >= maxItems) return;
      (props as AutocompleteMultipleProps<T>).onChange([...valueArray, newValue]);
    } else {
      (props as AutocompleteSingleProps<T>).onChange(newValue);
    }

    updateInputValue('', 'reset');
    setIsOpen(false);
    onCreateOption?.(trimmed);
  };

  // Reset highlighted index when options change. Adjusted while rendering, not
  // from an effect: the highlight is drawn from this value in THIS render, so an
  // effect commits one frame highlighting whatever row now happens to sit at the
  // old index — and Enter pressed in that frame selects it.
  const [highlightedFor, setHighlightedFor] = useState(filteredOptions.length);
  if (highlightedFor !== filteredOptions.length) {
    setHighlightedFor(filteredOptions.length);
    setHighlightedIndex(-1);
  }

  // Handle input change
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    updateInputValue(e.target.value, 'input');
    if (!isOpen) {
      setIsOpen(true);
    }
    setHighlightedIndex(-1);
  };

  // Handle option selection
  const handleSelect = (option: AutocompleteOption<T>) => {
    if (multiple) {
      // Multiple mode: toggle selection
      const isSelected = valueArray.includes(option.value);

      if (isSelected) {
        (props as AutocompleteMultipleProps<T>).onChange(valueArray.filter(v => v !== option.value));
      } else {
        if (maxItems && valueArray.length >= maxItems) {
          return;
        }
        (props as AutocompleteMultipleProps<T>).onChange([...valueArray, option.value]);
      }

      updateInputValue('', 'reset');
      inputRef.current?.focus();
    } else {
      // Single mode: select and close
      (props as AutocompleteSingleProps<T>).onChange(option.value);
      // When clearOnOpen is false, keep the label as inputValue so
      // filteredOptions is pre-computed before the next open (prevents flicker)
      updateInputValue(clearOnOpen ? '' : option.label, 'reset');
      setIsOpen(false);
    }
  };

  // Handle clear
  const handleClearAll = (e: ReactMouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (multiple) {
      (props as AutocompleteMultipleProps<T>).onChange([]);
    } else {
      (props as AutocompleteSingleProps<T>).onChange(null);
    }
    if (!isInputControlled) {
      setInternalInputValue('');
    }
    onInputChange?.('', 'clear');
    setIsOpen(false);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          openDropdown();
        }
        setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (showCreateOption) {
          handleCreate();
        } else if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        } else if (freeSolo && inputValue.trim()) {
          const newOption: AutocompleteOption<T> = {
            label: inputValue.trim(),
            value: inputValue.trim() as T,
          };
          handleSelect(newOption);
        }
        break;
      case 'Escape': {
        // Restore label when clearOnOpen is false, same as handleOpenChange close
        const resetValue = !multiple && !clearOnOpen && selectedOption ? selectedOption.label : '';
        updateInputValue(resetValue, 'reset');
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      }
      case 'Backspace':
        break;
    }
  };

  // Handle popover open/close
  const handleOpenChange = (open: boolean) => {
    if (open) {
      openDropdown();
    } else {
      // When clearOnOpen is false and there's a selection, restore the label
      // so filteredOptions stays pre-computed for the next open
      const resetValue = !multiple && !clearOnOpen && selectedOption ? selectedOption.label : '';
      updateInputValue(resetValue, 'reset');
      setIsOpen(false);
    }
  };

  const canAddMore = multiple ? !maxItems || valueArray.length < maxItems : true;
  const hasValue = valueArray.length > 0;

  const popover = (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={handleOpenChange} modal={false}>
      <PopoverPrimitive.Anchor asChild>
        <div
          // Same marker Input/Textarea/Select expose — it is how a form finds
          // (and scrolls to) the first field that failed validation.
          data-invalid={isInvalid || undefined}
          className={cn(
            // Layout — single line, no wrapping
            'flex min-h-11 cursor-text items-center rounded-[6px] border md:min-h-12',
            'focus-within:outline-none',
            'transition-colors duration-200',
            'border-ods-border bg-ods-card',
            'group',
            !disabled &&
              'hover:border-ods-border-hover hover:bg-ods-bg-hover active:border-ods-border-active active:bg-ods-bg-active',
            disabled && '!cursor-not-allowed bg-ods-bg',
            // Adornments / chevron carry their own colour — grey them with the
            // value so a disabled field reads as one flat colour. Scoped to the
            // DIRECT span child (the start adornment) on purpose: as a descendant
            // rule it also hit the selected `Tag` chips in the middle zone, whose
            // label is a span, and they went invisible against their own fill in
            // the light theme. Anything nested inside the adornment that sets its
            // own colour keeps it; anything that doesn't inherits the grey.
            'has-[:disabled]:[&>span]:text-ods-text-disabled has-[:disabled]:[&_svg]:text-ods-text-disabled',
            isOpen && !isInvalid && 'border-ods-accent hover:border-ods-accent',
            isInvalid && 'border-ods-error hover:border-ods-error',
          )}
          onClick={() => {
            if (!disabled) {
              inputRef.current?.focus();
              openDropdown();
            }
          }}
        >
          {/* Start Adornment */}
          {startAdornment && (
            <span
              className={cn(
                'flex-shrink-0 pl-3 text-ods-text-secondary transition-colors duration-200 [&_svg]:size-4 md:[&_svg]:size-6',
                isOpen && !isInvalid && 'text-ods-accent',
                isInvalid && 'text-ods-error',
              )}
            >
              {startAdornment}
            </span>
          )}

          {/* Middle zone: tags + input — single line with overflow */}
          <div ref={middleRef} className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-2">
            {/* Tags (multiple mode only) */}
            {multiple &&
              visibleTags.map(option => (
                <Tag
                  key={String(option.value)}
                  variant="outline"
                  labelClassName="max-w-[90px] truncate"
                  label={renderTag ? renderTag(option) : option.label}
                  onClose={
                    !disabled
                      ? () => {
                          (props as AutocompleteMultipleProps<T>).onChange(valueArray.filter(v => v !== option.value));
                        }
                      : undefined
                  }
                />
              ))}

            {/* Overflow indicator button (multiple mode only) */}
            {multiple && hiddenTagsCount > 0 && (
              <div ref={hiddenTagsRef} className="shrink-0">
                <button
                  ref={badgeRef}
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setShowHiddenTags(prev => {
                      if (!prev) setIsOpen(false);
                      return !prev;
                    });
                  }}
                  className={cn(
                    'flex h-8 items-center px-2',
                    'rounded-[6px] border border-ods-border bg-ods-card',
                    'text-ods-text-secondary text-h5',
                    'cursor-pointer transition-colors hover:bg-ods-bg-hover',
                  )}
                >
                  {getLimitTagsText(hiddenTagsCount)}
                </button>
              </div>
            )}

            {/* Input */}
            {canAddMore && (
              <input
                ref={inputRef}
                type="text"
                value={inputDisplayValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => openDropdown()}
                placeholder={inputPlaceholder}
                disabled={disabled}
                className={innerInputStyles}
              />
            )}
          </div>

          {/* Clear / Chevron — pinned right */}
          <div className="flex shrink-0 items-center gap-1 pr-3">
            {showClearAll && (hasValue || inputValue.length > 0) && !disabled && isOpen && (
              <button
                type="button"
                onClick={handleClearAll}
                className="flex items-center justify-center transition-opacity hover:opacity-70"
                aria-label="Clear all"
              >
                <XmarkCircleIcon className="size-4 text-ods-text-secondary md:size-6" />
              </button>
            )}
            {loading ? (
              <Loader2
                className={cn(
                  'size-4 animate-spin md:size-6',
                  isInvalid ? 'text-ods-error' : isOpen ? 'text-ods-accent' : 'text-ods-text-secondary',
                )}
              />
            ) : (
              showChevron && (
                <Chevron02DownIcon
                  className={cn(
                    'size-4 transition-all duration-200 md:size-6',
                    'text-ods-text-secondary',
                    isOpen && 'rotate-180',
                    isOpen && !isInvalid && 'text-ods-accent',
                    isInvalid && 'text-ods-error',
                  )}
                />
              )
            )}
          </div>
        </div>
      </PopoverPrimitive.Anchor>

      <PopoverPrimitive.Content
        className={cn(
          'z-50 mt-1 w-[var(--radix-popover-trigger-width)]',
          'rounded-[4px] border border-ods-border bg-ods-card',
          'flex max-h-[var(--radix-popper-available-height)] flex-col overflow-hidden',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
          dropdownClassName,
        )}
        sideOffset={4}
        align="start"
        // The anchor is the text field that raises the software keyboard, so
        // this list is always positioned with the keyboard up — see
        // useKeyboardCollisionPadding.
        collisionPadding={{ bottom: keyboardPadding }}
        onOpenAutoFocus={e => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
        onInteractOutside={e => {
          // Don't close if clicking inside the anchor/input container
          if (containerRef.current?.contains(e.target as Node)) {
            e.preventDefault();
          }
        }}
      >
        <ScrollAreaPrimitive.Root className="flex min-h-0 flex-col overflow-hidden">
          <ScrollAreaPrimitive.Viewport className="max-h-[240px] min-h-0 w-full [&>div]:!block">
            <div role="listbox">
              {loading ? (
                <div className="px-3 py-2 text-ods-text-secondary text-h6">{loadingText}</div>
              ) : filteredOptions.length === 0 ? (
                showCreateOption ? (
                  isCreateTooLong ? (
                    <div className="flex h-11 min-w-0 items-center px-[var(--spacing-system-mf)] text-ods-error text-h5 md:h-12">
                      Maximum {maxCreateLength} characters
                    </div>
                  ) : (
                    <div
                      role="option"
                      aria-selected={false}
                      className={cn(
                        'flex h-11 min-w-0 cursor-pointer items-center px-[var(--spacing-system-mf)] transition-colors md:h-12',
                        'text-ods-accent text-h4',
                        'hover:bg-ods-bg-hover',
                      )}
                      onClick={handleCreate}
                    >
                      {/* text-current: the row owns the typography/color (accent), not the TruncateText defaults. */}
                      <TruncateText className="text-current">{`+ Create "${inputValue.trim()}"`}</TruncateText>
                    </div>
                  )
                ) : (
                  <div className="px-3 py-2 text-ods-text-secondary text-h6">
                    {freeSolo && inputValue.trim() ? (
                      <span>Press Enter to add &quot;{inputValue}&quot;</span>
                    ) : (
                      noOptionsText
                    )}
                  </div>
                )
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = valueArray.includes(option.value);
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <div
                      key={String(option.value)}
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        'group/item flex h-11 cursor-pointer items-center border-b border-ods-border px-[var(--spacing-system-mf)] transition-colors last:border-b-0 md:h-12',
                        'text-h4',
                        isHighlighted && 'bg-ods-bg-surface',
                        isSelected ? 'text-ods-accent' : 'text-ods-text-primary',
                        !isHighlighted && 'hover:bg-ods-bg-hover',
                      )}
                      onClick={() => handleSelect(option)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      {renderOption ? (
                        renderOption(option, isSelected)
                      ) : (
                        <div className="flex w-full min-w-0 items-center justify-between gap-[var(--spacing-system-xsf)]">
                          {/* text-current: selection state colors the row (accent vs primary); inherit it. */}
                          <TruncateText className="text-current">{option.label}</TruncateText>
                          <div className="flex shrink-0 items-center gap-[var(--spacing-system-xsf)]">
                            {isSelected && <CheckIcon className="text-ods-accent" size={20} />}
                            {onDeleteOption && !isSelected && (
                              <button
                                type="button"
                                aria-label={`Delete ${option.label}`}
                                onClick={e => {
                                  e.stopPropagation();
                                  onDeleteOption(option.value);
                                }}
                                disabled={isDeletingOption}
                                className="opacity-0 transition-opacity focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-50 group-hover/item:opacity-100"
                              >
                                <TrashIcon className="size-4 text-ods-error" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollAreaPrimitive.Viewport>
          <ScrollAreaPrimitive.Scrollbar className="hidden" orientation="vertical">
            <ScrollAreaPrimitive.Thumb />
          </ScrollAreaPrimitive.Scrollbar>
        </ScrollAreaPrimitive.Root>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Root>
  );

  return (
    <FieldWrapper label={label} error={error} className={className}>
      <div className="relative" ref={containerRef}>
        {popover}

        {/* Hidden tags popup — outside overflow-hidden; right-anchored to the field */}
        {multiple && showHiddenTags && hiddenTagsCount > 0 && (
          <HiddenTagsPopup
            ref={hiddenTagsPopupRef}
            items={hiddenTags}
            disabled={disabled}
            className="left-auto right-0 max-w-full"
            onRemove={value => {
              const newValue = valueArray.filter(v => v !== value);
              (props as AutocompleteMultipleProps<T>).onChange(newValue);
              if (typeof limitTagsProp === 'number' && newValue.length <= limitTagsProp) setShowHiddenTags(false);
            }}
          />
        )}

        {/* Off-screen measurement containers for auto-limit */}
        {multiple && (
          <>
            <span
              ref={textMeasureRef}
              aria-hidden="true"
              className="pointer-events-none invisible absolute left-0 top-0 -z-10 whitespace-nowrap text-h4"
            >
              {inputPlaceholder}
            </span>
            <div
              ref={measureRef}
              aria-hidden="true"
              className="pointer-events-none invisible absolute left-0 top-0 -z-10 flex gap-2"
            >
              {selectedOptions.map(option => (
                <Tag
                  key={`m-${String(option.value)}`}
                  variant="outline"
                  labelClassName="max-w-[90px] truncate"
                  label={renderTag ? renderTag(option) : option.label}
                  onClose={() => {}}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </FieldWrapper>
  );
}

// Use overloaded signatures so TS can narrow single vs multiple based on the `multiple` prop
type AutocompleteComponent = {
  <T = string>(props: AutocompleteMultipleProps<T> & { ref?: ForwardedRef<HTMLDivElement> }): ReactElement;
  <T = string>(props: AutocompleteSingleProps<T> & { ref?: ForwardedRef<HTMLDivElement> }): ReactElement;
};

export const Autocomplete = forwardRef(AutocompleteInner) as AutocompleteComponent;
