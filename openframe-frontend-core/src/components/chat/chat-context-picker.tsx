'use client';

/**
 * Entity-context picker for the chat composer (Figma nodes 31:28312 /
 * 31:28708 / 31:28709 / 1:5699). Three pieces, all driven by the host's
 * `ChatContextPickerConfig`:
 *
 *   1. `<ChatComposerPlusMenu>` — the `+` button → small menu
 *      (Upload File / Assign Item). "Assign Item" opens the picker.
 *   2. `<ChatContextPicker>` — the two-level popover, rendered ABOVE the
 *      input (same `absolute bottom-full` placement as the slash-command
 *      suggestions). Level 1 = entity-type list; level 2 = a searchable
 *      multi-select of that type's items, with a ✓ on the chosen ones.
 *   3. `<ChatContextChipStrip>` — the removable selected-item chips,
 *      rendered above the input (mirrors `ChatAttachmentChipStrip`).
 *
 * The library owns ONLY the UI + selection state plumbing. Every item comes
 * from the host's `config.search(type, query, signal)` resolver — the lib
 * never knows a device from a script. All colors are ODS tokens.
 */

import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Chevron02LeftIcon } from '../icons-v2-generated/arrows/chevron-02-left-icon';
import { PackagePlusIcon } from '../icons-v2-generated/coding/package-plus-icon';
import { SearchIcon } from '../icons-v2-generated/interface/search-icon';
import { Upload02Icon } from '../icons-v2-generated/interface/upload-02-icon';
import { PlusIcon } from '../icons-v2-generated/signs-and-symbols/plus-icon';
import { XmarkCircleIcon } from '../icons-v2-generated/signs-and-symbols/xmark-circle-icon';
import { LoadingSuspense } from '../loading/loading-fallback';
import { Button } from '../ui/button';
import { LOADING_NOOP, useLoadingScope } from '../ui/loading-scope';
import {
  CONTEXT_BACK_BAR_CLASS,
  CONTEXT_STATE_CLASS,
  ContextErrorBoundary,
  ContextItemsList,
  ContextMenuRow,
} from './context-items-list';
import type { ChatContextEntityType, ChatContextItem, ChatContextPickerConfig } from './types/context-item.types';

/** Default ceiling on selected context items (Figma spec). */
export const CHAT_CONTEXT_ITEMS_DEFAULT_MAX = 10;

/** The items list the Suspense fallback draws in a loading scope: no items yet, nothing selectable. */
const NO_SELECTED_KEYS: Set<string> = new Set();

/** Debounce (ms) before the typed query is handed to `renderItems`. */
const SEARCH_DEBOUNCE_MS = 300;

const itemKey = (item: { type: string; id: string }) => `${item.type}:${item.id}`;

// ===========================================================================
// `+` TRIGGER — opens the single context dropdown (Figma node 31:28275)
// ===========================================================================

export interface ChatComposerPlusMenuProps {
  /** Toggle the entity-context picker open/closed. */
  onToggle: () => void;
  /** Whether the picker is currently open (drives the lit/yellow state). */
  open?: boolean;
  /** Disable the trigger (e.g. while streaming). */
  disabled?: boolean;
  /** The context dropdown — rendered anchored to THIS button (so the popover
   *  aligns to the `+`, not the whole input). Pass `<ChatContextPicker>`. */
  dropdown?: ReactNode;
}

/**
 * The composer `+` button (Figma node 31:28275 — sits INSIDE the input as a
 * start adornment). Per the Figma annotation on 31:28312 ("don't show for
 * first version — show dropdown with item types"), there is NO intermediate
 * "Upload File / Assign Item" menu: the `+` opens the single `ChatContextPicker`
 * dropdown (type list → searchable items) directly.
 *
 * The 24×24 glyph is grey at rest, WHITE on hover of the glyph itself, and
 * accent-yellow while pressed or while the dropdown is open. `data-context-
 * trigger` lets the picker's outside-click handler ignore clicks on this button
 * so toggling works cleanly.
 */
export function ChatComposerPlusMenu({
  onToggle,
  open = false,
  disabled = false,
  dropdown,
}: ChatComposerPlusMenuProps) {
  return (
    // `relative` so the dropdown anchors to the button itself (bottom-full),
    // aligning the popover to the `+` rather than the input row.
    <span className="relative inline-flex">
      <Button
        variant="bare"
        data-tone="accent"
        size="icon-sm"
        type="button"
        data-context-trigger=""
        disabled={disabled}
        aria-label="Add context"
        aria-expanded={open}
        title="Add context"
        onClick={onToggle}
        className="shrink-0"
      >
        <PlusIcon />
      </Button>
      {dropdown}
    </span>
  );
}

// ===========================================================================
// PICKER — two-level popover (Figma nodes 31:28708 / 31:28709)
// ===========================================================================

export interface ChatContextPickerProps {
  /** When false the popover renders nothing. */
  open: boolean;
  config: ChatContextPickerConfig;
  /** Currently-selected items (drives the ✓ state in the list). */
  selectedItems: ChatContextItem[];
  /** Toggle an item in/out of the selection. */
  onToggleItem: (item: ChatContextItem) => void;
  /** Close the popover (Escape, outside-click, header X). */
  onClose: () => void;
  /**
   * Query seeded from the `@`-mention trigger. Filters the entity-type list
   * while the picker sits on level 1; consumed when a type is opened.
   */
  mentionQuery?: string | null;
  className?: string;
}

// Single dropdown, three nested levels (Figma 31:28312 → 31:28708 → 31:29102):
//   root  = Upload File / Assign Item
//   types = Back + entity-type list
//   items = Back + search + selectable items
type PickerView = 'root' | 'types' | 'items';

export function ChatContextPicker({
  open,
  config,
  selectedItems,
  onToggleItem,
  onClose,
  mentionQuery,
  className,
}: ChatContextPickerProps) {
  const [view, setView] = useState<PickerView>('root');
  const [activeType, setActiveType] = useState<ChatContextEntityType | null>(null);
  const [query, setQuery] = useState(''); // immediate search-field value
  const [debouncedQuery, setDebouncedQuery] = useState(''); // handed to renderItems

  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const maxItems = config.maxItems ?? CHAT_CONTEXT_ITEMS_DEFAULT_MAX;
  const atLimit = selectedItems.length >= maxItems;

  const selectedKeys = useMemo(() => new Set(selectedItems.map(itemKey)), [selectedItems]);

  // The open/close reset reads `mentionQuery` as it stands AT THAT MOMENT, so
  // it must not be a dependency: as one it would re-run the whole reset on
  // every keystroke of an active `@` filter and throw away the drilled-in view.
  const mentionQueryRef = useRef(mentionQuery);
  useEffect(() => {
    mentionQueryRef.current = mentionQuery;
  });

  // Reset on open AND close (close pre-resets so the next open's first paint is
  // the initial view, not the stale level — avoids a flash).
  useEffect(() => {
    setView(open && mentionQueryRef.current != null ? 'types' : 'root');
    setActiveType(null);
    setQuery('');
    setDebouncedQuery('');
  }, [open]);

  // If `@` starts filtering while still on the root menu, drill into the types.
  // Done while rendering, not from an effect: the keystroke that started the
  // filter has already scheduled this render, so drilling here means the types
  // list is what that render paints instead of the root menu flashing first.
  // Self-terminating (`view` is no longer `'root'`), so the extra render pass
  // React schedules takes the early exit.
  if (open && mentionQuery != null && view === 'root') setView('types');

  // Outside-click + Escape close. Registered only while open.
  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      // Ignore clicks on the `+` trigger — it owns the open/close toggle.
      if (rootRef.current?.contains(target) || target?.closest?.('[data-context-trigger]')) return;
      onClose();
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open, onClose]);

  // Focus the search field when entering the items view.
  useEffect(() => {
    if (!open || view !== 'items') return undefined;
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, view]);

  // Debounce the typed query before handing it to the host's `renderItems`
  // (which keys its hooks on it) — keeps the data layer off every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  // Cap the popover to the space ACTUALLY visible above the `+` button. The
  // popover is `bottom-full`-anchored, so its bounding-rect bottom equals the
  // button top. The usable TOP is NOT the viewport top — the chat lives inside a
  // panel/drawer whose body clips overflow below its header — so we measure to the
  // nearest scroll/clip ancestor's top, not the window. Height = (button top) −
  // (clip-container top) − gap; the popover then scrolls within that slice.
  // Re-measured on open, view change, resize, and once after the Drawer open
  // animation settles (rAF + delayed pass) so we don't lock a mid-animation value.
  const [measuredMaxH, setAvailMaxH] = useState<number | undefined>(undefined);
  // A closed popover has no measurement — that is a fact about `open`, so it is
  // masked here rather than written back into state from the layout effect
  // (which is also why the next open starts from the `max-h-[70vh]` fallback
  // instead of briefly re-using the slice measured for the previous position).
  const availMaxH = open ? measuredMaxH : undefined;
  useLayoutEffect(() => {
    if (!open) return undefined;
    const measure = () => {
      const el = rootRef.current;
      if (!el) return;
      const bottom = el.getBoundingClientRect().bottom;
      // Find the nearest ancestor that clips overflow — that top edge, not the
      // window's, is where the popover starts getting hidden.
      let clipTop = 0;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const oy = getComputedStyle(p).overflowY;
        if (oy === 'auto' || oy === 'scroll' || oy === 'hidden') {
          clipTop = p.getBoundingClientRect().top;
          break;
        }
      }
      setAvailMaxH(Math.max(180, Math.floor(bottom - clipTop - 12)));
    };
    measure();
    const raf = requestAnimationFrame(measure);
    const settle = setTimeout(measure, 320);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
      window.removeEventListener('resize', measure);
    };
  }, [open, view]);

  const openType = useCallback((type: ChatContextEntityType) => {
    setActiveType(type);
    setQuery('');
    setDebouncedQuery('');
    setView('items');
  }, []);

  const backToTypes = useCallback(() => {
    setActiveType(null);
    setQuery('');
    setDebouncedQuery('');
    setView('types');
  }, []);

  // Filter the type list by the `@`-mention query (level 1 only).
  const typeFilter = (mentionQuery ?? '').trim().toLowerCase();
  const visibleTypes = useMemo(
    () =>
      typeFilter ? config.entityTypes.filter(t => t.label.toLowerCase().includes(typeFilter)) : config.entityTypes,
    [config.entityTypes, typeFilter],
  );

  if (!open) return null;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Add context"
      // `maxHeight` is measured to the real gap above the `+` button (see effect),
      // so the popover always fits the available slice; `max-h-[70vh]` is the
      // pre-measurement fallback. The popover itself scrolls (`overflow-y-auto`)
      // when its content can't fit that height — no fragile flex-1 chains.
      style={{ maxHeight: availMaxH }}
      className={cn(
        // Anchored to the `+` button (its `relative` parent): left edge aligns
        // to the button, `bottom-full` floats it just above with a 4px gap.
        'absolute bottom-full left-0 z-50 mb-1 flex max-h-[70vh] w-[320px] max-w-[90vw] flex-col overflow-y-auto overflow-x-hidden overscroll-contain',
        // Mirror `DropdownMenuContent` chrome (border / card bg / shadow-md).
        'rounded-md border border-ods-border bg-ods-card text-ods-text-primary shadow-md',
        className,
      )}
      // Keep textarea focus from being stolen on internal pointer interactions
      // that aren't real selections (e.g. scrollbar drags).
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      {view === 'root' ? (
        /* Level 0 — Upload File / Assign Item (Figma 31:28312). */
        <div role="menu" aria-label="Add context" className="divide-y divide-ods-border">
          {config.onUploadFile && (
            <ContextMenuRow
              icon={<Upload02Icon size={24} />}
              label="Upload File"
              onClick={() => config.onUploadFile?.()}
            />
          )}
          <ContextMenuRow icon={<PackagePlusIcon size={24} />} label="Assign Item" onClick={() => setView('types')} />
        </div>
      ) : view === 'types' ? (
        /* Level 1 — Back + entity-type list (Figma 31:28708). Back stays pinned;
           the type list scrolls if it can't fit the capped popover height. */
        <div role="menu" aria-label="Context types" className="flex flex-col divide-y divide-ods-border">
          {/* Pinned while the popover body scrolls (the root is the scroll
              container) — the bar's `bg-ods-bg` keeps rows from showing through. */}
          <div className={CONTEXT_BACK_BAR_CLASS}>
            <Button variant="row" type="button" onClick={() => setView('root')}>
              <Chevron02LeftIcon size={24} />
              <span className="truncate">Back</span>
            </Button>
          </div>
          {visibleTypes.length === 0 ? (
            <div className={CONTEXT_STATE_CLASS}>No matching types</div>
          ) : (
            visibleTypes.map(type => (
              <ContextMenuRow key={type.type} icon={type.icon} label={type.label} onClick={() => openType(type)} />
            ))
          )}
        </div>
      ) : activeType ? (
        /* Level 2 — Back + search + HOST-rendered items (Figma 31:29102). */
        <>
          <div className={cn(CONTEXT_BACK_BAR_CLASS, 'border-b border-ods-border')}>
            <Button variant="row" type="button" onClick={backToTypes}>
              <Chevron02LeftIcon size={24} />
              <span className="truncate">Back</span>
            </Button>
          </div>

          <div className="flex shrink-0 items-center gap-2 border-b border-ods-border bg-ods-card p-3">
            <SearchIcon className="size-4 shrink-0 text-ods-text-secondary md:size-6" />
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Search for ${activeType.label}`}
              className="min-w-0 flex-1 bg-transparent font-medium leading-6 text-ods-text-primary outline-none text-h4 placeholder:text-ods-text-secondary"
            />
          </div>

          {/* Items are HOST-rendered (data via the host's own hooks → a
              `<ContextItemsList>`). Initial load → Suspense skeleton; a failed
              fetch → the error row with a Retry. The boundary resets when
              type/query changes; Retry also resets react-query's cached suspense
              error (`reset()`) so re-opening the SAME type+query refetches. */}
          <QueryErrorResetBoundary>
            {({ reset }) => (
              <ContextErrorBoundary
                resetKey={`${activeType.type}:${debouncedQuery}`}
                fallback={retry => (
                  <div className="flex items-center justify-between gap-2 bg-ods-bg px-4 py-3 text-ods-attention-red-error text-h4">
                    <span>Failed to load</span>
                    <Button
                      variant="link"
                      size="compact"
                      noPaddingX
                      type="button"
                      data-tone="neutral"
                      onClick={() => {
                        reset();
                        retry();
                      }}
                      className="shrink-0"
                    >
                      Retry
                    </Button>
                  </div>
                )}
              >
                <ContextItems
                  renderItems={config.renderItems}
                  args={{
                    type: activeType.type,
                    query: debouncedQuery,
                    selectedKeys,
                    onToggle: onToggleItem,
                    atLimit,
                  }}
                />
              </ContextErrorBoundary>
            )}
          </QueryErrorResetBoundary>
        </>
      ) : null}
    </div>
  );
}

type ContextItemsArgs = Parameters<ChatContextPickerConfig['renderItems']>[0];

/** The host-rendered items of a type, with their own boundary: in its scope the reader draws the list's skeleton rows. */
function ContextItems(props: { renderItems: ChatContextPickerConfig['renderItems']; args: ContextItemsArgs }) {
  return (
    <LoadingSuspense label="Loading items">
      <ContextItemsReader {...props} />
    </LoadingSuspense>
  );
}

/** In a loading scope, the SAME list the host renders with no items (one page of its own skeleton rows); else the host's. */
function ContextItemsReader({
  renderItems,
  args,
}: {
  renderItems: ChatContextPickerConfig['renderItems'];
  args: ContextItemsArgs;
}) {
  if (useLoadingScope())
    return <ContextItemsList items={[]} selectedKeys={NO_SELECTED_KEYS} onToggle={LOADING_NOOP} atLimit={false} />;
  return <>{renderItems(args)}</>;
}

// ===========================================================================
// CHIP STRIP — selected items above the input (Figma node 1:5699)
// ===========================================================================

export interface ChatContextChipStripProps {
  items: ChatContextItem[];
  /** Remove handler. When omitted the chips are read-only (message bubble). */
  onRemove?: (item: ChatContextItem) => void;
  /** Lead icon resolver, e.g. the entity-type icon. Optional. */
  resolveIcon?: (item: ChatContextItem) => ReactNode;
  /**
   * Optional host renderer that REPLACES the default label-only pill for an
   * item — e.g. a self-fetching entity chip that resolves its own live display
   * name by id, identical to an inline `@marker:id` mention. Return
   * `null`/`undefined` for an item to fall back to the default pill. The lib
   * owns no entity knowledge, so the host node owns its full chrome (the
   * `onRemove` affordance is NOT wrapped around host-rendered items — this is
   * meant for the read-only message bubble, mirroring `renderMention`).
   */
  renderItem?: (item: ChatContextItem) => ReactNode;
  disabled?: boolean;
  className?: string;
  /**
   * Makes a chip's icon and label a button — e.g. the page the composer sits on,
   * whose click asks Mingo about it. The × (`onRemove`) stays its own button.
   */
  onSelect?: (item: ChatContextItem) => void;
  /** What a click on a chip does: its tooltip and accessible name, before the label (with `onSelect`). */
  selectHint?: string;
}

/**
 * Horizontal strip of selected-context chips. Returns `null` when empty — no
 * permanent footprint. Used both in the composer (removable) and on the sent
 * user bubble (read-only, no `onRemove`).
 */
export function ChatContextChipStrip({
  items,
  onRemove,
  resolveIcon,
  renderItem,
  disabled = false,
  className,
  onSelect,
  selectHint,
}: ChatContextChipStripProps) {
  if (items.length === 0) return null;
  const chipFace = (item: ChatContextItem) => (
    <>
      {resolveIcon && (
        <span className="flex size-4 shrink-0 items-center justify-center text-ods-text-secondary [&_svg]:size-4">
          {resolveIcon(item)}
        </span>
      )}
      <span
        className="max-w-[220px] truncate font-mono font-medium uppercase tracking-[-0.28px] text-h5"
        title={onSelect ? undefined : item.label}
      >
        {item.label}
      </span>
    </>
  );
  return (
    // `tag` pills (Figma 1:6073): 32px tall, card surface, bordered, mono-
    // uppercase label, 16px lead icon + xmark-circle remove. Wraps to new rows.
    <div className={cn('flex flex-wrap content-center items-center gap-2', className)}>
      {items.map(item => {
        // Host-rendered chip (self-fetching mention analogue) takes over the
        // whole pill when provided and non-null; otherwise the default pill.
        const hostNode = renderItem?.(item);
        if (hostNode != null) return <Fragment key={itemKey(item)}>{hostNode}</Fragment>;
        const selectName = selectHint ? `${selectHint}: ${item.label}` : item.label;
        return (
          <div
            key={itemKey(item)}
            className={cn(
              'flex h-8 shrink-0 items-center gap-2 rounded-md border border-ods-border bg-ods-card px-2 text-ods-text-primary',
              onSelect && 'transition-colors has-[[data-chip-select]:hover]:border-ods-border-hover',
            )}
            role="group"
            aria-label={`Context ${item.label}`}
          >
            {onSelect ? (
              <Button
                variant="bare"
                size="wrap"
                type="button"
                data-chip-select=""
                onClick={() => onSelect(item)}
                disabled={disabled}
                title={selectName}
                aria-label={selectName}
                className="min-w-0 gap-2 text-ods-text-primary hover:text-ods-accent focus-visible:text-ods-accent [&_svg]:size-4"
              >
                {chipFace(item)}
              </Button>
            ) : (
              chipFace(item)
            )}
            {onRemove && (
              <Button
                variant="bare"
                size="icon-inline"
                type="button"
                onClick={() => onRemove(item)}
                disabled={disabled}
                aria-label={`Remove ${item.label}`}
              >
                <XmarkCircleIcon size={16} />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
