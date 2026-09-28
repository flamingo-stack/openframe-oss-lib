'use client';

import {
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useAutoLimitTags } from '../../hooks/ui/use-auto-limit-tags';
import { useIsomorphicLayoutEffect } from '../../hooks/ui/use-isomorphic-layout-effect';
import { cn } from '../../utils/cn';
import { SearchIcon } from '../icons-v2-generated/interface/search-icon';
import { XmarkCircleIcon } from '../icons-v2-generated/signs-and-symbols/xmark-circle-icon';
import { HiddenTagsPopup } from './hidden-tags-popup';
import { Tag } from './tag';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TagSearchOption<T = string> {
  label: string;
  value: T;
}

export interface TagSearchInputProps<T = string> {
  /** Active tags displayed inline */
  tags: TagSearchOption<T>[];
  /** Controlled search input value */
  searchValue: string;
  /** Called when input text changes */
  onSearchChange: (value: string) => void;
  /** Called when a single tag is removed */
  onTagRemove: (value: T) => void;
  /** Called when the clear-all button is clicked (clears tags + input) */
  onClearAll?: () => void;
  /** Placeholder when no tags are present */
  placeholder?: string;
  /** Placeholder when tags exist */
  addMorePlaceholder?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Extra class names for the outer wrapper */
  className?: string;
  /** Show the clear-all (x) icon on the right. Default true */
  showClearAll?: boolean;
  /** Called when Enter is pressed */
  onSubmit?: (value: string) => void;
  /** Forward arbitrary key events */
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** Custom render for tag label */
  renderTag?: (option: TagSearchOption<T>) => ReactNode;
  /** Custom render function for the "+N" overflow text */
  getLimitTagsText?: (more: number) => ReactNode;
  /** Maximum number of visible tags. Set to "auto" for automatic calculation based on available width. Default "auto" */
  limitTags?: number | 'auto';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TagSearchInput<T = string>({
  tags,
  searchValue,
  onSearchChange,
  onTagRemove,
  onClearAll,
  placeholder = 'Search...',
  addMorePlaceholder = 'Add More...',
  disabled = false,
  className,
  showClearAll = true,
  onSubmit,
  onKeyDown,
  renderTag,
  getLimitTagsText = (more: number) => `+${more}`,
  limitTags = 'auto',
}: TagSearchInputProps<T>) {
  const currentPlaceholder = tags.length === 0 ? placeholder : addMorePlaceholder;

  const { visibleCount, middleRef, measureRef, textMeasureRef, badgeRef, inputRef } = useAutoLimitTags({
    count: tags.length,
    limitTags,
    placeholder: currentPlaceholder,
  });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const hiddenTagsRef = useRef<HTMLDivElement>(null);
  const hiddenTagsPopupRef = useRef<HTMLDivElement>(null);
  const [showHiddenTags, setShowHiddenTags] = useState(false);

  // ---- Close hidden tags popup on outside click ----
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

  // The popup is rendered OUTSIDE the overflow-hidden tag row, so it has to be
  // pushed across to sit under the `+N` badge. Measured in a layout effect
  // rather than during render: `getBoundingClientRect()` is a value React does
  // not track, so a render-time read pinned the popup to wherever the badge
  // happened to be at that one render and never followed it afterwards —
  // removing a tag from the popup shifts the badge left, and the popup stayed
  // behind. Unconditional so every commit re-measures; it runs before paint,
  // so there is no visible jump.
  useIsomorphicLayoutEffect(() => {
    const popup = hiddenTagsPopupRef.current;
    const badge = badgeRef.current;
    if (!popup || !badge) return;
    const originLeft = wrapperRef.current?.getBoundingClientRect().left ?? 0;
    popup.style.left = `${badge.getBoundingClientRect().left - originLeft}px`;
  });

  // ---- Derived state ----
  const hiddenCount = tags.length - visibleCount;
  const visibleTags = tags.slice(0, visibleCount);
  const hiddenTags = tags.slice(visibleCount);
  const hasValue = tags.length > 0 || searchValue.length > 0;

  // ---- Event handlers ----
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit(searchValue);
    }
    onKeyDown?.(e);
  };

  const handleClearAll = (e: ReactMouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onClearAll?.();
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className="relative">
      {/* ---- Visible container ---- */}
      <div
        className={cn(
          'flex h-11 cursor-text items-center rounded-[6px] border md:h-12',
          'transition-colors duration-200',
          'border-ods-border bg-ods-card',
          'has-[:focus]:border-ods-accent',
          !disabled && 'hover:border-ods-border-hover hover:bg-ods-bg-hover',
          disabled && 'bg-ods-bg',
          disabled && 'cursor-not-allowed',
          // Match Input: grey the text and the icons, don't fade the whole
          // control (a blanket opacity also washes out the border). Icons only —
          // this container has no adornment spans of its own, so a `[&_span]`
          // rule would ONLY have reached the selected `Tag` chips, whose label is
          // a span, and greyed them into their own fill in the light theme.
          'has-[:disabled]:[&_svg]:text-ods-text-disabled',
          className,
        )}
        onClick={() => {
          if (!disabled) inputRef.current?.focus();
        }}
      >
        {/* Search icon — pinned left, responsive size */}
        <div className="flex shrink-0 items-center pl-3">
          <SearchIcon className="size-4 text-ods-text-secondary md:size-6" />
        </div>

        {/* Middle zone: tags + input — overflow hidden so tags never push clear btn */}
        <div ref={middleRef} className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-2">
          {visibleTags.map(tag => (
            <Tag
              key={String(tag.value)}
              variant="outline"
              label={renderTag ? renderTag(tag) : tag.label}
              labelClassName="max-w-[120px] truncate"
              onClose={!disabled ? () => onTagRemove(tag.value) : undefined}
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
              >
                {getLimitTagsText(hiddenCount)}
              </button>
            </div>
          )}

          {/* Search input */}
          <input
            ref={inputRef}
            type="text"
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentPlaceholder}
            disabled={disabled}
            className={cn(
              'min-w-[60px] flex-1 border-none bg-transparent outline-none',
              'text-h4',
              'text-ods-text-primary placeholder:text-ods-text-secondary',
              // Disabled - match Input exactly (value greys out, placeholder dims further)
              'disabled:cursor-not-allowed disabled:text-ods-text-disabled disabled:placeholder:text-ods-border',
            )}
          />
        </div>

        {/* Clear all — pinned right */}
        {showClearAll && hasValue && !disabled && (
          <button
            type="button"
            onClick={handleClearAll}
            className="flex shrink-0 cursor-pointer items-center justify-center pr-3 transition-opacity hover:opacity-70"
            aria-label="Clear all"
          >
            <XmarkCircleIcon className="size-4 text-ods-text-secondary md:size-6" />
          </button>
        )}
      </div>

      {/* ---- Hidden tags popup — outside overflow-hidden, positioned under badge ---- */}
      {showHiddenTags && hiddenCount > 0 && (
        <HiddenTagsPopup
          ref={hiddenTagsPopupRef}
          items={hiddenTags}
          disabled={disabled}
          onRemove={value => {
            onTagRemove(value as T);
            if (hiddenCount <= 1) setShowHiddenTags(false);
          }}
        />
      )}

      {/* ---- Off-screen measurement containers ---- */}
      <span
        ref={textMeasureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 -z-10 whitespace-nowrap text-h4"
      >
        {currentPlaceholder}
      </span>

      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 -z-10 flex gap-2"
      >
        {tags.map(tag => (
          <Tag
            key={`m-${String(tag.value)}`}
            variant="outline"
            label={renderTag ? renderTag(tag) : tag.label}
            labelClassName="max-w-[120px] truncate"
            onClose={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
