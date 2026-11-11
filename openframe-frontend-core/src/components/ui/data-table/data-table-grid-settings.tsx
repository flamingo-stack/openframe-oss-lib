'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import type { Column } from '@tanstack/react-table';
import type React from 'react';
import { useContext, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';
import { CheckboxCheckmarkIcon, CheckFillIcon, DraggerIcon, Settings02Icon } from '../../icons-v2-generated';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../dropdown-menu';
import { useDataTableContext } from './data-table';
import { gridCellClass, gridCellStyle, mergeColumnOrder, type GridColumn } from './data-table-grid';
import { GridPrefsContext, GridSettingsContext, useGridPrefs } from './data-table-grid-prefs';

/** A column's name in the settings menu: its `meta.label`, else its header when that is plain text, else its id. */
function columnLabel(column: Column<unknown, unknown>): string {
  const { header, meta } = column.columnDef;
  return meta?.label ?? (typeof header === 'string' && header !== '' ? header : column.id);
}

/** Where a dragged row lands among the other rows: after every row whose middle is above the pointer. */
export function dropIndex(middles: number[], pointerY: number): number {
  return middles.filter(middle => middle < pointerY).length;
}

/** `ids` with one id moved to `to`. */
export function moveId(ids: string[], id: string, to: number): string[] {
  const next = ids.filter(other => other !== id);
  next.splice(to, 0, id);
  return next;
}

const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((id, index) => id === b[index]);

/**
 * The gear in the header of the table's last column (the design's `table/utility-cell`, type settings). It opens the
 * settings menu; the cell keeps its hover fill while the menu is open.
 */
export function GridSettingsHeaderCell({ column }: { column: GridColumn }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cn(gridCellClass(column, 'header'), 'hover:bg-ods-card', open && 'bg-ods-card')}
      style={gridCellStyle(column)}
      data-grid-settings-cell
    >
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Table settings"
            className="flex items-center justify-center rounded-md p-[var(--spacing-system-xsf)] text-ods-text-primary outline-none focus-visible:ring-1 focus-visible:ring-ods-accent"
          >
            <Settings02Icon size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="max-h-[var(--radix-popper-available-height)] w-[280px] overflow-y-auto rounded-md border border-ods-border bg-ods-bg p-0 shadow-lg"
        >
          <GridSettingsMenu />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const ROW_CLASS =
  'flex min-h-10 cursor-pointer select-none items-center gap-[var(--spacing-system-xsf)] border-b border-ods-border bg-ods-bg py-[var(--spacing-system-xsf)] pl-[var(--spacing-system-mf)] pr-[var(--spacing-system-xsf)] text-ods-text-primary outline-none transition-colors last:border-b-0 data-[highlighted]:bg-ods-bg-hover';
const LABEL_CLASS = 'min-w-0 flex-1 truncate text-h4';
const MARK_CLASS = 'flex size-5 shrink-0 items-center justify-center';

function MenuSeparator() {
  return <DropdownMenuPrimitive.Separator className="h-[3px] w-full bg-ods-bg-surface" />;
}

/** A menu row keeps the menu open: it switches something, it is not an action. */
const keepOpen = (event: Event) => event.preventDefault();

/**
 * The settings menu (the design's `table/settings-menu`): auto-refresh when the page offers it, then the columns the
 * table shows, in order, then the columns the viewer hid. A row switches its column on or off (hiding a column also
 * resets its filter); a shown column moves by its dragger, or with Alt + Arrow Up / Down. Selection and action columns
 * are not listed: they are always there.
 */
function GridSettingsMenu() {
  const table = useDataTableContext();
  const settings = useContext(GridSettingsContext);
  const { store } = useContext(GridPrefsContext);
  const prefs = useGridPrefs();
  const listRef = useRef<HTMLDivElement | null>(null);
  // The row to focus again once a change has been drawn: the browser drops focus from a row that is re-inserted (a
  // move) or drawn anew in the other list (shown, hidden), and the menu's keys would stop answering.
  const refocusRef = useRef<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; order: string[] } | null>(null);

  useLayoutEffect(() => {
    const id = refocusRef.current;
    if (id === null) return;
    refocusRef.current = null;
    listRef.current?.querySelector<HTMLElement>(`[data-settings-row="${CSS.escape(id)}"]`)?.focus();
  });

  const columns = table.getVisibleFlatColumns().filter(column => !column.columnDef.meta?.gridKind);
  const labels = new Map(columns.map(column => [column.id, columnLabel(column)]));
  const ordered = mergeColumnOrder(
    columns.map(column => column.id),
    prefs.order,
  );
  const hiddenIds = new Set(prefs.hidden);
  const anyShown = ordered.some(id => !hiddenIds.has(id));
  // The same rule as the table's own layout: a stored layout that hides everything is not applied.
  const shown = anyShown ? ordered.filter(id => !hiddenIds.has(id)) : ordered;
  const hidden = anyShown ? ordered.filter(id => hiddenIds.has(id)) : [];

  const show = (id: string) => {
    refocusRef.current = id;
    store.update(current => ({ ...current, order: ordered, hidden: current.hidden.filter(other => other !== id) }));
  };
  const hide = (id: string) => {
    // The last shown column stays: a table needs one.
    if (shown.length <= 1) return;
    refocusRef.current = id;
    // A hidden column does not go on filtering: its header, the one place that shows and resets its filter, is gone
    // with it, and the list would stay narrowed with nothing on screen to say why.
    const column = table.getColumn(id);
    if (column?.getIsFiltered()) column.setFilterValue(undefined);
    store.update(current => ({
      ...current,
      order: ordered,
      hidden: [...(anyShown ? current.hidden : []).filter(other => other !== id), id],
    }));
  };
  /** The shown columns in a new order; a hidden column keeps its own place among them. */
  const reorder = (nextShown: string[]) => {
    if (sameOrder(nextShown, shown)) return;
    const hiddenNow = new Set(hidden);
    let next = 0;
    const order = ordered.map(id => {
      if (hiddenNow.has(id)) return id;
      const moved = nextShown[next];
      next += 1;
      return moved;
    });
    store.update(current => ({ ...current, order }));
  };

  const onRowKeyDown = (event: React.KeyboardEvent, id: string) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    // Alt + arrow moves the column; the bare arrows stay the menu's own (they move the focus).
    event.preventDefault();
    event.stopPropagation();
    const to = shown.indexOf(id) + (event.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= shown.length) return;
    refocusRef.current = id;
    reorder(moveId(shown, id, to));
  };

  const onDraggerPointerDown = (event: React.PointerEvent, id: string) => {
    if (event.button !== 0) return;
    const view = event.currentTarget.ownerDocument.defaultView;
    if (!view) return;
    // No text selection and no focus change while the row is dragged.
    event.preventDefault();
    let order = shown;
    setDrag({ id, order });

    // On the window, in the capture phase: the row under the pointer is re-inserted as the order changes, and the
    // menu's own rows must not see the drag (a row would take a pointer-up without a pointer-down for a pick).
    const onMove = (move: PointerEvent) => {
      move.stopPropagation();
      const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-settings-column]') ?? []);
      const middles = rows
        .filter(row => row.dataset.settingsColumn !== id)
        .map(row => {
          const box = row.getBoundingClientRect();
          return box.top + box.height / 2;
        });
      const next = moveId(order, id, dropIndex(middles, move.clientY));
      if (sameOrder(next, order)) return;
      order = next;
      setDrag({ id, order });
    };
    const onEnd = (end: PointerEvent) => {
      end.stopPropagation();
      view.removeEventListener('pointermove', onMove, true);
      view.removeEventListener('pointerup', onEnd, true);
      view.removeEventListener('pointercancel', onEnd, true);
      // The click that ends the drag is not a pick of the row it ends on.
      const swallowClick = (click: MouseEvent) => {
        click.stopPropagation();
        click.preventDefault();
      };
      view.addEventListener('click', swallowClick, { capture: true, once: true });
      view.setTimeout(() => view.removeEventListener('click', swallowClick, true), 0);
      setDrag(null);
      reorder(order);
    };
    view.addEventListener('pointermove', onMove, true);
    view.addEventListener('pointerup', onEnd, true);
    view.addEventListener('pointercancel', onEnd, true);
  };

  const autoRefresh = settings?.autoRefresh;
  const drawn = drag?.order ?? shown;

  return (
    <div ref={listRef} data-grid-settings-menu>
      {autoRefresh && (
        <>
          <DropdownMenuPrimitive.CheckboxItem
            className={ROW_CLASS}
            checked={autoRefresh.enabled}
            onCheckedChange={autoRefresh.onChange}
            onSelect={keepOpen}
          >
            <span
              className={cn(
                MARK_CLASS,
                'rounded-md',
                autoRefresh.enabled
                  ? 'bg-ods-accent text-ods-text-on-accent'
                  : 'border-2 border-ods-text-secondary bg-transparent',
              )}
            >
              {autoRefresh.enabled && <CheckboxCheckmarkIcon size={12} />}
            </span>
            <span className={LABEL_CLASS}>Enable auto-refresh</span>
          </DropdownMenuPrimitive.CheckboxItem>
          <MenuSeparator />
        </>
      )}
      {drawn.map(id => (
        <DropdownMenuPrimitive.CheckboxItem
          key={id}
          data-settings-row={id}
          data-settings-column={id}
          data-dragging={drag?.id === id || undefined}
          className={cn(ROW_CLASS, drag?.id === id && 'bg-ods-bg-hover')}
          checked
          // The last shown column cannot be hidden.
          aria-disabled={shown.length <= 1 || undefined}
          aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
          onCheckedChange={() => hide(id)}
          onSelect={keepOpen}
          onKeyDown={event => onRowKeyDown(event, id)}
        >
          <span
            data-settings-dragger
            className={cn(MARK_CLASS, 'cursor-grab touch-none text-ods-text-secondary')}
            onPointerDown={event => onDraggerPointerDown(event, id)}
            // A press on the dragger is a drag, never a pick of the row.
            onClick={event => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <DraggerIcon size={20} />
          </span>
          <span className={LABEL_CLASS}>{labels.get(id)}</span>
          <CheckFillIcon size={20} className="shrink-0 text-ods-accent" />
        </DropdownMenuPrimitive.CheckboxItem>
      ))}
      {hidden.length > 0 && <MenuSeparator />}
      {hidden.map(id => (
        <DropdownMenuPrimitive.CheckboxItem
          key={id}
          data-settings-row={id}
          data-settings-hidden-column={id}
          className={ROW_CLASS}
          checked={false}
          onCheckedChange={() => show(id)}
          onSelect={keepOpen}
        >
          {/* A hidden column has no place to drag to: its dragger is drawn off. */}
          <span className={cn(MARK_CLASS, 'text-ods-border')}>
            <DraggerIcon size={20} />
          </span>
          <span className={LABEL_CLASS}>{labels.get(id)}</span>
        </DropdownMenuPrimitive.CheckboxItem>
      ))}
    </div>
  );
}
