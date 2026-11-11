'use client';

import { type MouseEvent, useCallback, useId, useMemo, useState } from 'react';
import Link from '../../embed-shims/next-link';
import { useClippedLabelTooltip } from '../../hooks/ui/use-clipped-label-tooltip';
import { useIsHydrated } from '../../hooks/ui/use-is-hydrated';
import type { NavigationSidebarItem } from '../../types/navigation';
import { cn } from '../../utils';
import { createLocalStorageAdapter } from '../../utils/local-storage-adapter';
import { Chevron02DownIcon } from '../icons-v2-generated';
import { FloatingTooltip } from '../ui/floating-tooltip';
import { CountPill } from './count-pill';
import { accessibleName, EASE, EXPANDED_ONLY, FOCUS_RING, HOVER_LAYER, sizedIcon } from './navigation-sidebar-grouped';
import { UnreadDot } from './unread-dot';

/*
 * The sectioned variant (`NavigationSidebarConfig.variant: 'sectioned'`), drawn
 * from the Figma `nav/item` set as the three-column shell's navigation uses it:
 * every group is a section of its own, divided from the next by the border, with
 * a 32px category row (a grey icon and label and a fold chevron — a category
 * "never gets a yellow fill") over its 40px rows (a light icon and a 14px label).
 * Every section is open until the user folds it. The secondary entries are one
 * more section at the bottom.
 *
 * As in the grouped variant, the expanded and the rail layouts follow the rail's
 * width (`@[140px]/of-nav-sidebar:`), not `minimized`; `showLabel` only feeds the
 * rail's `title` tooltips.
 */

/** The 40px row of an entry (a section's child or a leaf). */
const ROW_CLASSES = cn(
  'relative isolate flex h-10 w-full items-center overflow-hidden rounded-md text-left',
  'pl-[var(--spacing-system-xsf)] pr-0 @[140px]/of-nav-sidebar:pr-[var(--spacing-system-xsf)]',
  'transition-[padding] duration-300 motion-reduce:transition-none',
  EASE,
  FOCUS_RING,
  HOVER_LAYER,
);

/**
 * The current page's row: the shell's tint (ODS v2 `open colors/yellow sec`) under
 * the accent icon and label — not the grouped variant's brighter pill.
 */
export const TINT_PILL = 'bg-ods-accent-tint text-ods-accent';

/** The 32px category row of a section. */
const CATEGORY_CLASSES = cn(
  'group/nav-category relative isolate flex h-8 w-full items-center overflow-hidden rounded-md text-left',
  'pl-[var(--spacing-system-xsf)] pr-0 @[140px]/of-nav-sidebar:pr-[var(--spacing-system-xsf)]',
  'text-ods-text-panel-secondary transition-[padding,color] duration-300 motion-reduce:transition-none',
  'hover:text-ods-text-primary hover:after:opacity-100',
  EASE,
  FOCUS_RING,
  HOVER_LAYER,
);

/** One section: inset 8px all round, its rows 4px apart, the border above it. */
const SECTION_CLASSES =
  'flex flex-col gap-[var(--spacing-system-xxs)] border-t border-ods-border p-[var(--spacing-system-xsf)]';

/**
 * The primary `<nav>` of the sectioned variant: its first section has no border
 * above it (the top of the sidebar) and 12px of room instead of 8 — its category row
 * then sits in the middle of the 56px band of the column headers beside it (Figma
 * 1408:293075). Folded, it keeps 11px under the row: 55px, so the next section's top
 * border lies on the column headers' own bottom border (55–56px) and the close cell
 * beside it (55px) matches it exactly.
 */
export const SECTIONED_PRIMARY_NAV_CLASSES =
  'flex flex-col [&>:first-child]:border-t-0 [&>:first-child]:pt-[var(--spacing-system-sf)] [&>:first-child[data-folded]]:pb-[calc(var(--spacing-system-sf)-1px)]';

function isStoredSectionIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(id => typeof id === 'string');
}

/**
 * The sections the user folded. Every section is open by default; the one holding
 * the current page unfolds when the page changes. The stored set is read only
 * once hydrated (the server cannot read it, and a fold that differs on the
 * hydrating client is a hydration mismatch).
 */
export function useFoldedNavigationSections(activeSectionId: string | null, storageKey?: string) {
  const hydrated = useIsHydrated();
  const storage = useMemo(
    () =>
      storageKey
        ? createLocalStorageAdapter<string[]>({
            key: storageKey,
            validate: isStoredSectionIds,
            logTag: `[nav-sections:${storageKey}]`,
          })
        : null,
    [storageKey],
  );
  const stored = useMemo(() => (hydrated ? (storage?.load() ?? null) : null), [hydrated, storage]);
  const [chosen, setChosen] = useState<ReadonlySet<string> | null>(null);
  const folded = useMemo<ReadonlySet<string>>(() => chosen ?? new Set(stored ?? []), [chosen, stored]);

  // A page in a folded section unfolds it.
  const [unfoldFor, setUnfoldFor] = useState(activeSectionId);
  if (unfoldFor !== activeSectionId) {
    setUnfoldFor(activeSectionId);
    if (activeSectionId !== null && folded.has(activeSectionId)) {
      const next = new Set(folded);
      next.delete(activeSectionId);
      setChosen(next);
    }
  }

  const toggleSection = useCallback(
    (id: string) => {
      const next = new Set(folded);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setChosen(next);
      storage?.save([...next]);
    },
    [folded, storage],
  );

  return [folded, toggleSection] as const;
}

/** The label column: 14px, clipped labels show their full text in a tooltip. */
function SectionedLabel({
  label,
  showLabel,
  className,
  children,
}: {
  label: string;
  showLabel: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const { ref, enabled } = useClippedLabelTooltip<HTMLSpanElement>(label);
  return (
    <span
      className={cn(
        'ml-[var(--spacing-system-xsf)] flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)] overflow-hidden',
        EXPANDED_ONLY,
        className,
      )}
    >
      <FloatingTooltip
        content={label}
        side="top"
        as="span"
        disabled={!showLabel || !enabled}
        triggerClassName="min-w-0"
      >
        <span ref={ref} className="block min-w-0 truncate text-h6">
          {label}
        </span>
      </FloatingTooltip>
      {children}
    </span>
  );
}

function SectionedIcon({ item, className }: { item: NavigationSidebarItem; className?: string }) {
  return (
    <span className={cn('relative flex size-5 shrink-0 items-center justify-center', className)}>
      {sizedIcon(item.icon, 20)}
      {(item.unreadCount ?? 0) > 0 && <UnreadDot size="fixed" className="@[140px]/of-nav-sidebar:hidden" />}
    </span>
  );
}

interface RowProps {
  item: NavigationSidebarItem;
  isActive: boolean;
  isPending: boolean;
  showLabel: boolean;
  disabled: boolean;
  onClick: (item: NavigationSidebarItem, event?: MouseEvent) => void;
  /** A section's child (not a bottom-section leaf): its idle icon is light in the rail. */
  inSection?: boolean;
}

/**
 * The idle icon (Figma `nav/item`, `rail-item`): grey in the expanded sidebar; in the
 * 56px rail a section's children are light under their grey category icon, while the
 * bottom section stays grey. Read off the rail's width, like every expanded/rail switch.
 */
function idleIconClass(inSection: boolean): string {
  return inSection
    ? 'text-ods-text-primary @[140px]/of-nav-sidebar:text-ods-text-panel-secondary'
    : 'text-ods-text-panel-secondary';
}

/** An entry: a link (or a button for `onClick` / disabled). */
function SectionedRow({ item, isActive, isPending, showLabel, disabled, onClick, inSection = false }: RowProps) {
  const name = accessibleName(item);
  const lit = isActive && !disabled;
  const unreadCount = item.unreadCount ?? 0;
  const className = cn(
    ROW_CLASSES,
    !disabled && !isActive && 'text-ods-text-primary hover:after:opacity-100',
    !disabled && !isActive && isPending && 'after:opacity-100',
    lit && TINT_PILL,
    disabled && 'cursor-not-allowed text-ods-text-secondary opacity-50',
  );
  const content = (
    <>
      <SectionedIcon item={item} className={lit ? 'text-ods-accent' : idleIconClass(inSection)} />
      <SectionedLabel label={item.label} showLabel={showLabel}>
        {unreadCount > 0 && <CountPill count={unreadCount} className="ml-auto" />}
      </SectionedLabel>
    </>
  );
  const shared = {
    className,
    title: showLabel ? undefined : name,
    'aria-label': name,
    'aria-current': isActive ? ('page' as const) : undefined,
  };
  if (disabled || !item.path || item.onClick) {
    return (
      <button type="button" onClick={event => onClick(item, event)} disabled={disabled} {...shared}>
        {content}
      </button>
    );
  }
  return (
    <Link href={item.path} onClick={event => onClick(item, event)} {...shared}>
      {content}
    </Link>
  );
}

function Section({
  item,
  folded,
  activeId,
  pendingId,
  showLabel,
  disabled,
  onItemClick,
  onSectionClick,
}: {
  item: NavigationSidebarItem;
  folded: boolean;
  activeId: string | null;
  pendingId: string | null;
  showLabel: boolean;
  disabled: boolean;
  onItemClick: (item: NavigationSidebarItem, event?: MouseEvent) => void;
  onSectionClick: (item: NavigationSidebarItem) => void;
}) {
  const rowsId = `${useId()}-rows`;
  const name = accessibleName(item);
  return (
    // Folded, no gap under the category: the rows' box is 0px tall, and the gap would
    // still stand below it as empty room.
    <div className={cn(SECTION_CLASSES, folded && 'gap-0')} data-folded={folded || undefined}>
      <button
        type="button"
        onClick={() => onSectionClick(item)}
        disabled={disabled}
        aria-expanded={!folded}
        aria-controls={rowsId}
        aria-label={name}
        title={showLabel ? undefined : name}
        className={cn(CATEGORY_CLASSES, disabled && 'cursor-not-allowed opacity-50')}
      >
        <SectionedIcon item={item} />
        <SectionedLabel label={item.label} showLabel={showLabel}>
          <Chevron02DownIcon
            size={20}
            className={cn(
              'ml-auto shrink-0 transition-transform duration-300 motion-reduce:transition-none',
              EASE,
              folded && '-rotate-90',
            )}
          />
        </SectionedLabel>
      </button>
      <div
        id={rowsId}
        role="group"
        aria-label={item.label}
        inert={folded}
        className={cn(
          'grid transition-[grid-template-rows,visibility] duration-300 motion-reduce:transition-none',
          EASE,
          folded ? 'invisible grid-rows-[0fr]' : 'visible grid-rows-[1fr]',
        )}
      >
        <div className="flex min-h-0 flex-col gap-[var(--spacing-system-xxs)] overflow-hidden">
          {(item.children ?? []).map(child => (
            <SectionedRow
              key={child.id}
              item={child}
              isActive={child.id === activeId}
              isPending={child.id === pendingId}
              showLabel={showLabel}
              disabled={disabled}
              onClick={onItemClick}
              inSection
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export interface NavigationSidebarSectionedEntriesProps {
  items: readonly NavigationSidebarItem[];
  activeId: string | null;
  pendingId: string | null;
  foldedIds: ReadonlySet<string>;
  showLabel: boolean;
  disabled: boolean;
  onItemClick: (item: NavigationSidebarItem, event?: MouseEvent) => void;
  onSectionClick: (item: NavigationSidebarItem) => void;
}

/**
 * The sections of one `<nav>` block (the caller owns the landmark). An entry with
 * children is a section of its own; consecutive entries without children share
 * one section.
 */
export function NavigationSidebarSectionedEntries({
  items,
  activeId,
  pendingId,
  foldedIds,
  showLabel,
  disabled,
  onItemClick,
  onSectionClick,
}: NavigationSidebarSectionedEntriesProps) {
  const blocks: Array<{ key: string; section?: NavigationSidebarItem; leaves?: NavigationSidebarItem[] }> = [];
  for (const item of items) {
    if ((item.children?.length ?? 0) > 0) {
      blocks.push({ key: item.id, section: item });
    } else {
      const last = blocks[blocks.length - 1];
      if (last?.leaves) last.leaves.push(item);
      else blocks.push({ key: `leaves-${item.id}`, leaves: [item] });
    }
  }
  return (
    <>
      {blocks.map(block =>
        block.section ? (
          <Section
            key={block.key}
            item={block.section}
            folded={foldedIds.has(block.section.id)}
            activeId={activeId}
            pendingId={pendingId}
            showLabel={showLabel}
            disabled={disabled}
            onItemClick={onItemClick}
            onSectionClick={onSectionClick}
          />
        ) : (
          <div key={block.key} className={SECTION_CLASSES}>
            {(block.leaves ?? []).map(item => (
              <SectionedRow
                key={item.id}
                item={item}
                isActive={item.id === activeId}
                isPending={item.id === pendingId}
                showLabel={showLabel}
                disabled={disabled}
                onClick={onItemClick}
              />
            ))}
          </div>
        ),
      )}
    </>
  );
}
