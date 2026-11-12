'use client';

import { type ComponentPropsWithoutRef, type RefObject, forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { useMdUp } from '../../hooks/ui/use-media-query';
import { cn } from '../../utils/cn';
import { GridDotsBlankIcon } from '../icons-v2-generated';
import { ActionsMenu, ActionsMenuDropdown, type ActionsMenuItem } from '../ui/actions-menu';
import { Button } from '../ui/button';
import { Drawer, DrawerContent, DrawerTitle } from '../ui/drawer';
import { LoadingItems, useLoadingScope } from '../ui/loading-scope';
import { scrollFadeMask, useScrollFade } from '../ui/scroll-fade';
import { Tag } from '../ui/tag';
import {
  QuickActionChipButton,
  QuickActionChipFromData,
  type QuickActionChip,
  type QuickActionThemeSpec,
  isQuickActionIconSpec,
  renderQuickActionIcon,
} from './quick-action-chip';
import { WALL_SKELETON_LABEL_CH } from './quick-action-wall';

/** While the actions are read the row draws this many of its tags' loading form. */
const QUICK_ACTION_ROW_SKELETON_COUNT = 4;

/**
 * The All menu's box (Figma `chat/dock`, "Desktop · All open"): 320px wide, narrower where the room is, and about ten
 * rows high (a row is 2.5rem and its 1px divider), less where the room above the tag is; the rest scrolls inside it.
 */
const ALL_MENU_CLASS =
  'w-80 max-w-[var(--radix-popper-available-width)] max-h-[min(var(--radix-popper-available-height),calc(25rem+10px))]';

export interface QuickActionRowProps {
  /** The actions, in the order to show them (the host puts the page topic's own first). */
  chips: ReadonlyArray<QuickActionChip>;
  /** Tags pinned before the actions that are NOT actions (a mode switch such as "Start Guide Chat"): drawn first in
   *  the row, never listed under All, and shown also while there is no action. */
  leading?: ReadonlyArray<QuickActionChip>;
  /** Default theme for chips without their own (the agent's accent). */
  theme?: QuickActionThemeSpec;
  /** The actions are still read: the row draws its tags' loading form, at the row's own height. */
  loading?: boolean;
  /** The group's accessible name. */
  label?: string;
  className?: string;
}

/**
 * A chat's quick actions, above its composer (Figma `chat/quick-actions`, node 4832:14820): ONE line of outline tags
 * that never wraps and never cuts a name. What does not fit scrolls sideways (touch, trackpad, a mouse wheel over the
 * row, the Tab key), with a fade at an edge while more continues past it, and nothing moves on its own. "All" stays
 * pinned at the right and opens every action in a list: a menu that floats up over the page, about ten rows high with
 * the rest scrolling inside it under the same fade, and a sheet from the bottom on a phone.
 *
 * A click on a tag, or on a row of the All list, calls the action's `onSelect` (the chat sends its prompt); its
 * `onHoverStart` / `onHoverEnd` fire from both too. With nothing to show the row is not drawn.
 */
export function QuickActionRow(props: QuickActionRowProps) {
  const loading = useLoadingScope() || !!props.loading;
  if (!loading && props.chips.length === 0 && !props.leading?.length) return null;
  return <QuickActionRowBody {...props} />;
}

/**
 * The row once there is something to draw. Its own component, so the scroller is there from its first render: the
 * fade's observers and the wheel listener attach to the element when they mount, and a row that had nothing to show
 * at first (its actions arriving later, with no loading state before them) would otherwise never get them.
 */
function QuickActionRowBody({
  chips,
  leading = [],
  theme,
  loading: loadingProp = false,
  label = 'Quick actions',
  className,
}: QuickActionRowProps) {
  const loading = useLoadingScope() || loadingProp;
  const { scrollRef, fadeLeft, fadeRight, update } = useScrollFade<HTMLDivElement>('horizontal');
  useWheelSideways(scrollRef);

  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex shrink-0 items-center gap-[var(--spacing-system-xs)]', className)}
    >
      <div className="relative min-w-0 flex-1">
        {/* The scroller. Its padding (taken back by the margin) is the room a focused tag's ring needs: a box that
            scrolls sideways clips the other axis too. `scroll-px-10` keeps a tag reached with Tab clear of a fade. */}
        <div
          ref={scrollRef}
          onScroll={update}
          data-testid="quick-action-row-scroller"
          data-fade-left={(!loading && fadeLeft) || undefined}
          data-fade-right={(!loading && fadeRight) || undefined}
          className={cn(
            '-m-[var(--spacing-system-xxs)] flex items-center gap-[var(--spacing-system-xs)] p-[var(--spacing-system-xxs)]',
            'scroll-px-10 overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            loading ? 'overflow-x-hidden' : 'overflow-x-auto',
          )}
          style={loading ? undefined : scrollFadeMask('horizontal', fadeLeft, fadeRight)}
        >
          {leading.map(chip => (
            <QuickActionChipFromData key={chip.id} chip={chip} defaultTheme={theme} size="compact" />
          ))}
          {loading ? (
            <LoadingItems count={QUICK_ACTION_ROW_SKELETON_COUNT}>
              {i => (
                <QuickActionChipButton
                  loading
                  label=""
                  icon
                  size="compact"
                  labelCh={WALL_SKELETON_LABEL_CH[i % WALL_SKELETON_LABEL_CH.length]}
                  data-loading-item
                  data-testid="quick-action-row-loading-tag"
                />
              )}
            </LoadingItems>
          ) : (
            chips.map(chip => (
              <QuickActionChipFromData
                key={chip.id}
                chip={chip}
                defaultTheme={theme}
                size="compact"
                data-loading-item
              />
            ))
          )}
        </div>
      </div>
      {!loading && chips.length > 0 && <AllQuickActions chips={chips} theme={theme} title={label} />}
    </div>
  );
}

/** A wheel's line, in px, for the browsers that report lines instead of pixels. */
const WHEEL_LINE_PX = 16;

/**
 * A mouse wheel over the row scrolls it sideways: a mouse has no sideways wheel, and the row is one line. Only while
 * the row has somewhere to go in that direction; otherwise, and for a sideways gesture (a trackpad), the event is left
 * alone and the page scrolls as usual. A native listener, because React's `onWheel` is passive and cannot stop the
 * page from scrolling too.
 */
function useWheelSideways(scrollRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const room = el.scrollWidth - el.clientWidth;
      if (room <= 0) return;
      const atStart = el.scrollLeft <= 0;
      const atEnd = el.scrollLeft >= room - 1;
      if ((event.deltaY < 0 && atStart) || (event.deltaY > 0 && atEnd)) return;
      el.scrollLeft += event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * WHEEL_LINE_PX : event.deltaY;
      event.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scrollRef]);
}

/**
 * The "All" tag: an outline tag like the row's own, with the grid glyph. While its list is open (`aria-expanded`, which
 * the menu's trigger and the sheet's both set) it holds the pressed look, also under the pointer. The row's loading
 * form does not draw it (there is nothing to list yet): `data-loading-optional` says so.
 */
const AllTag = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof Button>>(function AllTagImpl(props, ref) {
  return (
    <Button
      ref={ref}
      variant="card"
      type="button"
      aria-label="All quick actions"
      data-loading-optional
      {...props}
      className="group/all flex w-auto shrink-0"
    >
      <Tag
        variant="outline"
        size="compact"
        icon={<GridDotsBlankIcon size={16} />}
        label="All"
        className="group-aria-expanded/all:border-ods-border-hover group-aria-expanded/all:bg-ods-bg-active"
      />
    </Button>
  );
});

/**
 * "All": the tag pinned at the row's right, and the list of every action it opens (the ones in the row too, so nobody
 * has to guess what is hidden). From `md` the list is a menu that opens UP from the tag, its right edge on the tag's,
 * and never flips down over the composer; under `md` it is a sheet from the bottom, full width.
 */
function AllQuickActions({
  chips,
  theme,
  title,
}: {
  chips: ReadonlyArray<QuickActionChip>;
  theme?: QuickActionThemeSpec;
  title: string;
}) {
  // Before the media query answers (the first render, the server) the list is the menu.
  const phone = useMdUp() === false;
  // Which form the list was opened in. One opened in the other form is closed: crossing `md` with it open closes it.
  const [openedAs, setOpenedAs] = useState<'menu' | 'sheet' | null>(null);
  const menuOpen = openedAs === 'menu' && !phone;
  const sheetOpen = openedAs === 'sheet' && phone;
  // The list closes by a pick. A host that then moves the focus itself (the chat's composer, where the user types
  // next) keeps it there: the list does not take it back to the tag. Any other close returns the focus to the tag.
  const pickedRef = useRef(false);
  const keepFocusAfterPick = (event: Event) => {
    const picked = pickedRef.current;
    pickedRef.current = false;
    if (!picked) return;
    const list = event.currentTarget instanceof Node ? event.currentTarget : null;
    const focused = document.activeElement;
    if (focused && focused !== document.body && !list?.contains(focused)) event.preventDefault();
  };

  const items = useMemo<ActionsMenuItem[]>(() => {
    const anyIcon = chips.some(chip => chip.icon != null);
    return chips.map(chip => {
      const accent = (chip.theme ?? theme)?.accent;
      const spec = isQuickActionIconSpec(chip.icon) ? chip.icon : undefined;
      const icon = spec
        ? renderQuickActionIcon({ ...spec, accent: spec.accent ?? accent, size: 20 })
        : renderQuickActionIcon(chip.icon);
      return {
        id: chip.id,
        label: chip.label,
        // A row without an icon keeps the icon's place when its neighbours have one, so the names line up.
        icon: icon ?? (anyIcon ? <span aria-hidden /> : undefined),
        onClick: chip.onSelect,
        onHoverStart: chip.onHoverStart,
        onHoverEnd: chip.onHoverEnd,
      };
    });
  }, [chips, theme]);
  // In the sheet a pick is a tap: nothing hovers there to preview.
  const sheetGroups = useMemo(
    () => [{ items: items.map(({ onHoverStart: _start, onHoverEnd: _end, ...item }) => item) }],
    [items],
  );
  const menuGroups = useMemo(() => [{ items }], [items]);

  if (phone) {
    return (
      <>
        <AllTag
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          onClick={() => {
            setOpenedAs('sheet');
          }}
        />
        <Drawer
          open={sheetOpen}
          onOpenChange={open => {
            setOpenedAs(open ? 'sheet' : null);
          }}
        >
          <DrawerContent
            side="bottom"
            flush
            aria-describedby={undefined}
            className="max-h-[80dvh] bg-ods-menu"
            onCloseAutoFocus={keepFocusAfterPick}
          >
            <div className="shrink-0 border-b border-ods-border-panel p-[var(--spacing-system-mf)]">
              <DrawerTitle>{title}</DrawerTitle>
            </div>
            <ActionsMenu
              variant="overlay"
              groups={sheetGroups}
              scrollFade
              onItemClick={() => {
                pickedRef.current = true;
                setOpenedAs(null);
              }}
              className="max-h-none min-h-0 min-w-0 flex-1 rounded-none border-0 shadow-none"
            />
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <ActionsMenuDropdown
      variant="overlay"
      scrollFade
      groups={menuGroups}
      onItemClick={() => {
        pickedRef.current = true;
      }}
      onCloseAutoFocus={keepFocusAfterPick}
      side="top"
      align="end"
      sideOffset={4}
      avoidCollisions={false}
      open={menuOpen}
      onOpenChange={open => {
        setOpenedAs(open ? 'menu' : null);
      }}
      className={ALL_MENU_CLASS}
      customTrigger={<AllTag />}
    />
  );
}
