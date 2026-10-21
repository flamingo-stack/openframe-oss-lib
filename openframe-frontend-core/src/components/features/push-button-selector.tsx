'use client';

import { Check } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { CONTROL_SIZE, TILE_SIZE } from '../../styles/component-sizes';
import { cn } from '../../utils/cn';
import { LoadingRegion } from '../loading/loading-region';
import { TextLineSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { Badge, Input } from '../ui';
import { useLoadingScope } from '../ui/loading-scope';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

/** Option ids are whatever the consumer keys its rows by — string (UUID / enum value) or numeric row id. */
export type SelectableOptionId = string | number;

export interface SelectableOption<Id extends SelectableOptionId = string> {
  id: Id; // Selection ID (UUID / value for platforms, numeric row id for DB-keyed rows)
  name: string; // Primary identifier (platform enum or item name)
  displayName?: string; // Optional display name (for platforms)
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  icon?: React.ReactNode;
  color?: string;
  disabled?: boolean; // If true, option is shown grayed out and not selectable
  disabledReason?: string; // Tooltip shown on hover when disabled — explains WHY it's unavailable
  section?: string; // Optional section ID to group options
}

export interface SectionDefinition {
  id: string; // Section identifier (matches option.section)
  label: string; // Display label for the section
  icon?: React.ReactNode; // Optional icon for the section header
  description?: string; // Optional description shown under section label
}

/** SERVER-SIDE search: the selector renders the input; the PARENT owns the
 *  query state and re-fetches `options` (never a client-side .filter of a
 *  pre-fetched list). While `isLoading`, the input stays mounted (typing
 *  must not lose focus to a skeleton swap). */
export interface PushButtonSelectorSearch {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

/** Lazy paging: the option list becomes a FIXED-HEIGHT scroll viewport with
 *  an IntersectionObserver sentinel near the bottom — the selector calls
 *  `onLoadMore` as the user scrolls; the parent appends to `options`. */
export interface PushButtonSelectorLazyLoad {
  hasMore: boolean;
  isFetchingMore: boolean;
  onLoadMore: () => void;
  /** CSS height of the scroll viewport (default '336px' ≈ 6 rows). */
  maxHeight?: string;
}

interface PushButtonSelectorProps<Id extends SelectableOptionId = string> {
  options: SelectableOption<Id>[];
  selectedIds: Id[];
  onSelectionChange: (selectedIds: Id[]) => void;
  multiSelect?: boolean;
  title?: string;
  helpText?: string;
  className?: string;
  selectionSummary?: boolean;
  optional?: boolean;
  isLoading?: boolean;
  error?: string | null;
  skeletonCount?: number;
  /** Whether the option rows carry a description line, for the skeleton drawn before the rows arrive (default
   *  true; with rows given, the rows decide). */
  optionDescriptions?: boolean;
  sections?: SectionDefinition[]; // Optional sections for grouping options
  /** Built-in server-side search input (see PushButtonSelectorSearch). */
  search?: PushButtonSelectorSearch;
  /** Built-in fixed-height scroll + infinite paging (see PushButtonSelectorLazyLoad). */
  lazyLoad?: PushButtonSelectorLazyLoad;
  /** Rendered inside the list when `options` is empty and not loading. */
  emptyMessage?: React.ReactNode;
  /** Rendered under the list (result counts, hints). */
  footer?: React.ReactNode;
}

/** The selector's layout, read by the selector and by its skeleton, so the skeleton is the selector's size. */
const SELECTOR_STACK_CLASS = 'space-y-4';
const SELECTOR_TITLE_CLASS = 'text-ods-text-primary text-h5';
const SELECTOR_HELP_CLASS = 'text-ods-text-secondary text-h6';
const OPTION_LIST_CLASS = 'space-y-3';
const SECTIONED_LIST_CLASS = 'space-y-4';
const SECTION_CLASS = 'space-y-2';
const SECTION_HEADER_CLASS = 'flex items-center gap-2 px-1';
const SECTION_LABEL_CLASS = 'font-semibold text-ods-text-primary text-h6';
const SECTION_DESCRIPTION_CLASS = 'text-ods-text-tertiary text-h6';
const OPTION_FRAME_CLASS = 'rounded-lg border p-4';
const OPTION_ROW_CLASS = 'flex items-center justify-between gap-4';
/** The row's lead: its icon, then its name and description. */
const OPTION_LEAD_CLASS = 'flex min-w-0 flex-1 items-center gap-3';
/** The selection box's frame; the box itself is static chrome, so the skeleton draws it for real (unchecked). */
const SELECTION_BOX_CLASS = `flex ${CONTROL_SIZE.selection} flex-shrink-0 items-center justify-center rounded border-2`;
const SELECTION_BOX_IDLE_CLASS = 'border-ods-border';
/** The box an option's icon sits in, read by the row and by its skeleton, so the skeleton's icon is the row's. */
const OPTION_ICON_BOX_CLASS = `flex ${TILE_SIZE.sm} shrink-0 items-center justify-center`;
/** An option row's resting surface (not selected, not disabled). */
const OPTION_IDLE_SURFACE_CLASS = 'border-ods-border bg-ods-bg';

/** One option row while it is read: the row's own frame, an icon box, its name (and description) lines and the
 *  selection box. */
function OptionRowSkeleton({ description = true }: { description?: boolean }) {
  return (
    <div className={cn(OPTION_FRAME_CLASS, OPTION_IDLE_SURFACE_CLASS)}>
      <div className={OPTION_ROW_CLASS}>
        <div className={OPTION_LEAD_CLASS}>
          <UnifiedSkeleton className={OPTION_ICON_BOX_CLASS} />
          <div className="min-w-0 flex-1">
            <TextLineSkeleton type="h6" className="w-24" />
            {description && <TextLineSkeleton type="h6" className="w-36" />}
          </div>
        </div>
        <div className={cn(SELECTION_BOX_CLASS, SELECTION_BOX_IDLE_CLASS)} aria-hidden />
      </div>
    </div>
  );
}

/** A section's header, drawn for real: its label and description are the page's own words. */
function SectionHeader({ section }: { section: SectionDefinition }) {
  return (
    <div className={SECTION_HEADER_CLASS}>
      {section.icon && <div className="text-ods-text-secondary">{section.icon}</div>}
      <div>
        <div className={SECTION_LABEL_CLASS}>{section.label}</div>
        {section.description && <div className={SECTION_DESCRIPTION_CLASS}>{section.description}</div>}
      </div>
    </div>
  );
}

/** Option rows while they are read, grouped under the real section headers when there are sections. */
function OptionListSkeleton({
  count,
  sections,
  description,
}: {
  count: number;
  sections?: SectionDefinition[];
  description?: boolean;
}) {
  const rows = (n: number) =>
    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows never reorder
    Array.from({ length: n }, (_, i) => <OptionRowSkeleton key={i} description={description} />);
  if (!sections || sections.length === 0) return <div className={OPTION_LIST_CLASS}>{rows(count)}</div>;
  const perSection = Math.max(1, Math.round(count / sections.length));
  return (
    <div className={SECTIONED_LIST_CLASS}>
      {sections.map(section => (
        <div key={section.id} className={SECTION_CLASS}>
          <SectionHeader section={section} />
          <div className={SECTION_CLASS}>{rows(perSection)}</div>
        </div>
      ))}
    </div>
  );
}

export interface PushButtonSelectorSkeletonProps {
  /** How many option rows to draw (the selector's `skeletonCount`). */
  count?: number;
  /** The selector's title and help text: static copy, drawn as they are. */
  title?: string;
  helpText?: string;
  /** Sections, whose headers are drawn as they are, each over its share of the rows. */
  sections?: SectionDefinition[];
  /** Whether the rows carry a description line under the name (default true). */
  description?: boolean;
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
  className?: string;
}

/**
 * The selector while its options are read: its title, section headers and help text drawn for real, every option
 * row a skeleton of the row. `PushButtonSelector` draws it while `isLoading` and in a loading scope.
 */
export function PushButtonSelectorSkeleton({
  count = 3,
  title,
  helpText,
  sections,
  description,
  region = true,
  className,
}: PushButtonSelectorSkeletonProps) {
  return (
    <LoadingRegion label="Loading options" announce={region} className={cn(SELECTOR_STACK_CLASS, className)}>
      {title && <h3 className={SELECTOR_TITLE_CLASS}>{title}</h3>}
      <OptionListSkeleton count={count} sections={sections} description={description} />
      {helpText && <div className={SELECTOR_HELP_CLASS}>{helpText}</div>}
    </LoadingRegion>
  );
}

// Error component using ODS error tokens
function PushButtonSelectorError({ message, title }: { message: string; title?: string }) {
  return (
    <div className="space-y-3">
      {title && <h3 className="text-ods-text-primary text-h5">{title}</h3>}
      <div className="rounded-lg border border-ods-error bg-ods-error-secondary p-4">
        <div className="text-ods-error text-h6">⚠️ {message}</div>
      </div>
    </div>
  );
}

export function PushButtonSelector<Id extends SelectableOptionId = string>({
  options,
  selectedIds,
  onSelectionChange,
  multiSelect = true,
  title,
  helpText,
  className = '',
  selectionSummary = false,
  optional = false,
  isLoading = false,
  error = null,
  skeletonCount = 3,
  optionDescriptions = true,
  sections,
  search,
  lazyLoad,
  emptyMessage,
  footer,
}: PushButtonSelectorProps<Id>) {
  // Lazy-load sentinel: observe within the scroll viewport so onLoadMore
  // fires as the user approaches the bottom. Hooks run unconditionally
  // (before the early returns) per the rules of hooks. Pass a STABLE
  // onLoadMore (react-query's fetchNextPage is) — an inline arrow re-arms
  // the observer each render (harmless, just wasteful).
  // A loading scope is a loading state of its own: the selector draws its skeleton, whatever `isLoading` says.
  const inScope = useLoadingScope();
  const loading = isLoading || inScope;
  // The rows' skeleton takes the given rows' shape (a name only, or a name and a description) when there are rows.
  const skeletonDescription = options.length > 0 ? options.some(option => !!option.description) : optionDescriptions;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const lazyHasMore = lazyLoad?.hasMore ?? false;
  const lazyFetching = lazyLoad?.isFetchingMore ?? false;
  const onLoadMore = lazyLoad?.onLoadMore;
  const optionCount = options.length;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root || !onLoadMore || !lazyHasMore) return undefined;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting) && !lazyFetching) {
          onLoadMore();
        }
      },
      { root, rootMargin: '80px' },
    );
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
    // optionCount: re-arm when the list grows (the sentinel moves).
  }, [lazyHasMore, lazyFetching, onLoadMore, optionCount]);

  const searchInput = search ? (
    <Input
      value={search.value}
      onChange={e => search.onChange(e.target.value)}
      placeholder={search.placeholder}
      aria-label={search.ariaLabel ?? search.placeholder ?? 'Search'}
    />
  ) : null;

  // Framed mode (search and/or lazyLoad): loading and error are NOT early
  // returns — the frame (title, search input, fixed-height viewport, footer)
  // must stay pixel-identical across loading/loaded/empty/error, with only
  // the viewport CONTENT swapping. An early-return skeleton dropped the
  // bordered viewport + footer and rendered shorter rows, so the whole
  // section collapsed and jumped on every debounced search.
  const framed = !!search || !!lazyLoad;

  // LOADING / ERROR STATES — legacy (unframed) consumers keep the historical
  // whole-component swap, byte-identical.
  if (loading && !framed) {
    return (
      <PushButtonSelectorSkeleton
        count={inScope && options.length > 0 ? options.length : skeletonCount}
        title={title}
        helpText={helpText}
        sections={sections}
        description={skeletonDescription}
        className={className}
      />
    );
  }
  if (error && !framed) {
    return (
      <div className={className}>
        <PushButtonSelectorError message={error} title={title} />
      </div>
    );
  }

  // VALIDATION: Only filter invalid selectedIds if options are loaded
  const validSelectedIds =
    options.length > 0 ? selectedIds.filter(id => options.some(option => option.id === id)) : selectedIds; // Keep all IDs if options not loaded yet

  // Dev warning for debugging (only when options are loaded)
  if (process.env.NODE_ENV === 'development' && options.length > 0 && validSelectedIds.length !== selectedIds.length) {
    const invalidIds = selectedIds.filter(id => !options.some(opt => opt.id === id));
    console.warn('[PushButtonSelector] Invalid selected IDs filtered:', invalidIds);
  }

  const toggleSelection = (optionId: Id) => {
    if (multiSelect) {
      const isSelected = validSelectedIds.includes(optionId);
      if (isSelected) {
        onSelectionChange(validSelectedIds.filter(id => id !== optionId));
      } else {
        onSelectionChange([...validSelectedIds, optionId]);
      }
    } else {
      // Single select mode
      onSelectionChange(validSelectedIds.includes(optionId) ? [] : [optionId]);
    }
  };

  const getSelectedOptions = () => options.filter(option => validSelectedIds.includes(option.id));

  // Helper to render a single option
  const renderOption = (option: SelectableOption<Id>) => {
    const isSelected = validSelectedIds.includes(option.id);

    const optionEl = (
      <div
        key={option.id}
        className={cn(
          'group transition-all duration-200',
          OPTION_FRAME_CLASS,
          option.disabled
            ? `${isSelected ? 'cursor-pointer' : 'cursor-not-allowed'} border-ods-border bg-ods-card opacity-40`
            : isSelected
              ? 'cursor-pointer border-ods-accent bg-ods-bg-surface shadow-sm'
              : cn('cursor-pointer hover:border-ods-border-hover hover:bg-ods-bg-hover', OPTION_IDLE_SURFACE_CLASS),
        )}
        // Disabled options can't be newly SELECTED, but an already-selected one
        // (e.g. it later became unavailable) must still be removable.
        onClick={() => (!option.disabled || isSelected) && toggleSelection(option.id)}
      >
        <div className={OPTION_ROW_CLASS}>
          <div className={OPTION_LEAD_CLASS}>
            {option.icon && (
              <div
                className={cn(
                  OPTION_ICON_BOX_CLASS,
                  'transition-transform duration-200',
                  isSelected ? 'scale-110' : 'group-hover:scale-105',
                )}
              >
                {option.icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-ods-text-primary text-h6">{option.displayName || option.name}</div>
              {option.description && (
                <div className="line-clamp-2 text-ods-text-secondary text-h6" title={option.description}>
                  {option.description}
                </div>
              )}
            </div>
          </div>

          {/* Selection Indicator */}
          <div
            className={cn(
              SELECTION_BOX_CLASS,
              'transition-all duration-200',
              isSelected
                ? 'scale-110 border-ods-accent bg-ods-accent'
                : cn(SELECTION_BOX_IDLE_CLASS, 'group-hover:border-ods-border-hover'),
            )}
          >
            {isSelected && <Check className="h-4 w-4 font-bold text-ods-text-primary" strokeWidth={3} />}
          </div>
        </div>
      </div>
    );

    // Disabled options explain WHY on hover via the unified Tooltip.
    if (option.disabled && option.disabledReason) {
      return (
        <Tooltip key={option.id}>
          <TooltipTrigger asChild>{optionEl}</TooltipTrigger>
          <TooltipContent className="max-w-xs">{option.disabledReason}</TooltipContent>
        </Tooltip>
      );
    }

    return optionEl;
  };

  // Group options by section if sections are provided
  const renderOptionsContent = () => {
    if (!sections || sections.length === 0) {
      // No sections - render flat list
      return <div className={OPTION_LIST_CLASS}>{options.map(renderOption)}</div>;
    }

    // Group options by section
    const optionsBySection = new Map<string, SelectableOption<Id>[]>();
    const ungroupedOptions: SelectableOption<Id>[] = [];

    options.forEach(option => {
      if (option.section) {
        const existing = optionsBySection.get(option.section) || [];
        optionsBySection.set(option.section, [...existing, option]);
      } else {
        ungroupedOptions.push(option);
      }
    });

    return (
      <div className={SECTIONED_LIST_CLASS}>
        {/* Render sections in order */}
        {sections.map(section => {
          const sectionOptions = optionsBySection.get(section.id) || [];
          if (sectionOptions.length === 0) return null;

          return (
            <div key={section.id} className={SECTION_CLASS}>
              <SectionHeader section={section} />
              <div className={SECTION_CLASS}>{sectionOptions.map(renderOption)}</div>
            </div>
          );
        })}

        {/* Render ungrouped options at the end */}
        {ungroupedOptions.length > 0 && <div className="space-y-2">{ungroupedOptions.map(renderOption)}</div>}
      </div>
    );
  };

  // ~82px per row: enough skeleton rows to fill the fixed viewport, so the
  // loading state occupies the SAME height as the loaded list.
  const framedSkeletonCount = lazyLoad ? Math.max(skeletonCount, 4) : skeletonCount;
  const listContent = loading ? (
    <LoadingRegion label="Loading options" announce={!inScope}>
      <OptionListSkeleton count={framedSkeletonCount} sections={sections} description={skeletonDescription} />
    </LoadingRegion>
  ) : error ? (
    <PushButtonSelectorError message={error} />
  ) : (
    <>
      {options.length === 0 && emptyMessage !== undefined ? (
        <div className="text-ods-text-secondary text-h6">{emptyMessage}</div>
      ) : (
        renderOptionsContent()
      )}
      {lazyLoad ? (
        <>
          <div ref={sentinelRef} />
          {/* The next page while it is read: one more option row's skeleton under the list. */}
          {lazyLoad.isFetchingMore ? (
            <LoadingRegion label="Loading more options">
              <OptionRowSkeleton />
            </LoadingRegion>
          ) : null}
        </>
      ) : null}
    </>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn(SELECTOR_STACK_CLASS, className)}>
        {title && <h3 className={SELECTOR_TITLE_CLASS}>{title}</h3>}

        {searchInput}

        {lazyLoad ? (
          <div
            ref={scrollRef}
            className="space-y-4 overflow-y-auto rounded-lg border border-ods-border p-2"
            style={{ height: lazyLoad.maxHeight ?? '336px' }}
          >
            {listContent}
          </div>
        ) : (
          listContent
        )}

        {footer}

        {/* Selection Summary */}
        {!loading && !error && selectionSummary && validSelectedIds.length > 0 && (
          <div className="rounded-lg border border-ods-success bg-ods-success-secondary p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-ods-success"></div>
              <span className="text-ods-success text-h6">
                {validSelectedIds.length} {multiSelect ? 'items' : 'item'} selected
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {getSelectedOptions().map(option => (
                <Badge key={option.id} className="bg-ods-accent text-ods-text-primary text-h6">
                  {option.displayName || option.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Help Text */}
        {helpText && <div className={SELECTOR_HELP_CLASS}>{helpText}</div>}

        {/* Empty State Warning */}
        {!loading && validSelectedIds.length === 0 && title && !optional && (
          <div className="rounded-lg border border-ods-error bg-ods-error-secondary p-3">
            <div className="text-ods-error text-h6">⚠️ Please select at least one option</div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
