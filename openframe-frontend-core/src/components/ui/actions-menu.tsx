'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { useControllableState } from '@radix-ui/react-use-controllable-state';
import { Check } from 'lucide-react';
import React, { useCallback } from 'react';
import Link from '../../embed-shims/next-link';
import { useViewportCollisionPadding, withViewportPadding } from '../../hooks/ui/use-viewport-collision-padding';
import { cn } from '../../utils/cn';
import { Chevron02RightIcon, Ellipsis01Icon } from '../icons-v2-generated';
import { ActionsMenuHeaderContext } from './actions-menu-header-context';
import { Button } from './button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './dropdown-menu';
import { InertWhileLoading, useLoadingScope } from './loading-scope';
import { useReportOverlayOpen } from './overlay-open-registry';
import { COLLISION_PADDING_PX, useCollisionBoundary, usePortalContainer } from './portal-container';
import { scrollFadeMask, useScrollFade } from './scroll-fade';

/** Trigger movement (px) that counts as "the user scrolled away" rather than
 *  touch-momentum jitter or the sub-pixel settle right after opening. */
const SCROLL_DISMISS_THRESHOLD_PX = 12;

export interface ActionsMenuItemIconAction {
  icon: React.ReactNode;
  'aria-label': string;
  onClick?: () => void;
  href?: string;
  openInNewTab?: boolean;
  disabled?: boolean;
}

export interface ActionsMenuItem {
  id: string;
  label: string;
  /**
   * Secondary text under the label: information about the item, not part of its name (e.g. "last poked 2h ago" on a
   * Poke item). Drawn in the secondary colour, smaller than the label; never fold it into `label`.
   */
  description?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /**
   * `checkbox`: one of many options, a box, the menu stays open. `radio`: one
   * option of a set (a choice, not a toggle) — a check on the chosen one, the
   * menu closes on a pick.
   */
  type?: 'item' | 'checkbox' | 'radio' | 'submenu' | 'separator';
  checked?: boolean;
  /**
   * Keep the dropdown open after this item is clicked instead of closing it
   * (e.g. multi-select add). Only affects ActionsMenuDropdown; `checkbox` and
   * `submenu` items always keep the menu open regardless. Defaults to closing.
   */
  closeOnSelect?: boolean;
  submenu?: ActionsMenuItem[];
  /** Render the row in the error/destructive color (label + icon). */
  danger?: boolean;
  /** Optional URL for navigation items */
  href?: string;
  /** Open the main-row `href` in a new tab (external app deep-links). */
  openInNewTab?: boolean;
  /**
   * Optional secondary action — a 40px-wide button on the right of the row
   * with a vertical divider. The main row keeps its primary click target;
   * the secondary is independently clickable (e.g. "open in new tab").
   */
  iconAction?: ActionsMenuItemIconAction;
  /**
   * The pointer enters the row, or keyboard focus moves onto it (a plain row only, not a link or a submenu
   * trigger): e.g. preview what picking it would do. The focus a menu gives its first row when it opens does NOT
   * fire it: nobody chose that row yet.
   */
  onHoverStart?: () => void;
  /** The pointer or the focus leaves the row. */
  onHoverEnd?: () => void;
}

/**
 * How a menu is drawn. `default`: the lib's menu (page ground, 48px rows from md). `overlay`: the design system's
 * Dropdown-menu as Figma draws it today (node 1791:5239): the overlay ground, 40px rows, 20px glyphs, a hovered row
 * one step lighter.
 */
export type ActionsMenuVariant = 'default' | 'overlay';

export interface ActionsMenuGroup {
  id?: string;
  items: ActionsMenuItem[];
  separator?: boolean;
}

export interface ActionsMenuProps {
  groups: ActionsMenuGroup[];
  className?: string;
  onItemClick?: (item: ActionsMenuItem) => void;
  /**
   * Optional node rendered as the menu's first row, above every group — e.g.
   * the mobile "…" menu surfaces the page's view-mode `TabSelector` here (the
   * tickets design). Separated from the rows below by the same border the rows
   * use; interaction stays the node's own — clicking it does not close the
   * menu by itself.
   */
  header?: React.ReactNode;
  /** See {@link ActionsMenuVariant}. Default `default`. */
  variant?: ActionsMenuVariant;
  /**
   * A menu with a height of its own (a `max-h-*` in `className`) and more rows than fit: the rows scroll inside the
   * frame and fade out at the edge they continue past, as a row of tags does sideways. The header, when there is one,
   * stays above the rows. Default off: the frame itself scrolls, with no fade.
   */
  scrollFade?: boolean;
}

interface ActionsMenuRowContextValue {
  variant: ActionsMenuVariant;
  /** True once a key was pressed inside the open menu: focus that moves after it was moved by the user. */
  keyboardMoved?: React.RefObject<boolean>;
}

/** What a menu's rows read from the menu they are in (a submenu's rows included). */
const ActionsMenuRowContext = React.createContext<ActionsMenuRowContextValue>({ variant: 'default' });

interface MenuItemProps {
  item: ActionsMenuItem;
  onItemClick?: (item: ActionsMenuItem) => void;
}

// A row's glyphs, the leading one and the trailing action's: 16px, 24px from md (the menu
// follows the window), whatever size the caller drew them at. The slot alone sized the box,
// so an `h-6 w-6` glyph squeezed to 16x24 below md and a `size={24}` one overflowed it.
const ROW_GLYPH_CLASSES = '[&_svg]:h-4 [&_svg]:w-4 md:[&_svg]:h-6 md:[&_svg]:w-6';

const ROW_CLASSES =
  'flex flex-1 min-w-0 items-center gap-[var(--spacing-system-xsf)] p-[var(--spacing-system-s)] cursor-pointer transition-colors bg-ods-bg outline-none';
const WRAPPER_CLASSES = 'relative flex items-stretch border-b border-ods-border last:border-b-0';

/** A menu's look, per {@link ActionsMenuVariant}: its frame, a row and its wrapper, the row's states, glyph and label. */
const MENU_SKIN: Record<
  ActionsMenuVariant,
  {
    frame: string;
    row: string;
    wrapper: string;
    rowIdle: string;
    rowOpen: string;
    glyphBox: string;
    glyph: string;
    label: string;
  }
> = {
  default: {
    frame: 'border-ods-border bg-ods-bg',
    row: ROW_CLASSES,
    wrapper: WRAPPER_CLASSES,
    rowIdle: 'text-ods-text-primary hover:bg-ods-bg-hover focus-visible:bg-ods-bg-hover',
    rowOpen: 'focus:bg-ods-bg-hover data-[state=open]:bg-ods-bg-active',
    glyphBox: 'h-4 w-4 md:h-6 md:w-6',
    glyph: ROW_GLYPH_CLASSES,
    label: 'flex-1 font-medium leading-6 text-h4',
  },
  overlay: {
    frame: 'border-ods-border bg-ods-menu',
    row: 'flex min-h-10 min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)] py-[var(--spacing-system-xs)] pl-[var(--spacing-system-mf)] pr-[var(--spacing-system-xs)] cursor-pointer transition-colors bg-ods-menu outline-none',
    wrapper: 'relative flex items-stretch border-b border-ods-border-panel last:border-b-0',
    rowIdle: 'text-ods-text-primary hover:bg-ods-menu-hover focus-visible:bg-ods-menu-hover',
    rowOpen: 'focus:bg-ods-menu-hover data-[state=open]:bg-ods-menu-hover',
    glyphBox: 'h-5 w-5',
    glyph: '[&_svg]:h-5 [&_svg]:w-5',
    label: 'min-w-0 flex-1 text-h4',
  },
};

// The row's trailing icon action: a cell of the row (its full height, an icon, secondary until hovered), after a
// hairline divider. One Button for both forms, a link and an action.
const SecondaryAction: React.FC<{ action: ActionsMenuItemIconAction }> = ({ action }) => {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (action.disabled) {
        e.preventDefault();
        return;
      }
      action.onClick?.();
    },
    [action],
  );

  return (
    <>
      <span
        aria-hidden="true"
        className={cn('w-px shrink-0 self-stretch bg-ods-border', action.openInNewTab && 'max-md:hidden')}
      />
      <Button
        variant="cell"
        type="button"
        href={action.href}
        prefetch={action.href ? false : undefined}
        openInNewTab={action.openInNewTab}
        aria-label={action['aria-label']}
        disabled={action.disabled}
        className={cn(ROW_GLYPH_CLASSES, action.openInNewTab && 'max-md:hidden')}
        onClick={handleClick}
      >
        {action.icon}
      </Button>
    </>
  );
};

const MenuItem: React.FC<MenuItemProps> = ({ item, onItemClick }) => {
  // Submenus below portal + collide against the OWNING surface, matching the
  // root menu (`DropdownMenuContent`). Read unconditionally — hooks first.
  const portalContainer = usePortalContainer();
  const collisionBoundary = useCollisionBoundary();
  const viewportPadding = useViewportCollisionPadding();
  const { variant, keyboardMoved } = React.useContext(ActionsMenuRowContext);
  const skin = MENU_SKIN[variant];
  const activate = useCallback(() => {
    if (item.disabled) return;
    if (item.type === 'checkbox') {
      item.onClick?.();
      onItemClick?.(item);
      return;
    }
    if (item.type === 'submenu') return;
    item.onClick?.();
    onItemClick?.(item);
  }, [item, onItemClick]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      activate();
    },
    [activate],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      activate();
    },
    [activate],
  );

  const handleLinkClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (item.disabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      item.onClick?.();
      onItemClick?.(item);
    },
    [item, onItemClick],
  );

  if (item.type === 'separator') {
    return <div className="h-1 w-full bg-ods-divider" />;
  }

  const itemClasses = cn(
    skin.row,
    item.disabled ? 'pointer-events-none cursor-not-allowed text-ods-text-secondary opacity-60' : skin.rowIdle,
  );

  const subTriggerClasses = cn(itemClasses, skin.rowOpen);

  const renderAsLink = !!item.href && item.type !== 'submenu' && item.type !== 'checkbox';

  const rowContent = (
    <>
      {item.icon && (
        <div
          className={cn(
            'flex flex-shrink-0 items-center justify-center',
            skin.glyphBox,
            skin.glyph,
            item.danger && 'text-ods-error',
            item.disabled && 'opacity-50',
          )}
        >
          {item.icon}
        </div>
      )}

      {item.description ? (
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              skin.label,
              item.disabled ? 'text-ods-text-secondary' : item.danger ? 'text-ods-error' : 'text-ods-text-primary',
            )}
          >
            {item.label}
          </span>
          <span className="text-ods-text-secondary text-h6">{item.description}</span>
        </span>
      ) : (
        <span
          className={cn(
            skin.label,
            item.disabled ? 'text-ods-text-secondary' : item.danger ? 'text-ods-error' : 'text-ods-text-primary',
          )}
        >
          {item.label}
        </span>
      )}

      {item.type === 'radio' && item.checked && (
        <Check className="h-4 w-4 shrink-0 text-ods-accent md:h-6 md:w-6" strokeWidth={3} aria-hidden="true" />
      )}

      {item.type === 'checkbox' && (
        <div
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded-md transition-colors md:h-6 md:w-6',
            item.checked ? 'bg-ods-accent' : 'border-2 border-ods-border bg-transparent',
          )}
        >
          {item.checked && <Check className="h-3 w-3 text-ods-text-on-accent md:h-4 md:w-4" strokeWidth={3} />}
        </div>
      )}

      {item.type === 'submenu' && <Chevron02RightIcon className="h-4 w-4 text-ods-text-secondary md:h-6 md:w-6" />}
    </>
  );

  if (renderAsLink && item.href) {
    return (
      <div className={skin.wrapper}>
        <Link
          href={item.href}
          prefetch={false}
          target={item.openInNewTab ? '_blank' : undefined}
          rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
          className={itemClasses}
          onClick={handleLinkClick}
          aria-disabled={item.disabled}
          tabIndex={item.disabled ? -1 : undefined}
        >
          {rowContent}
        </Link>
        {item.iconAction && <SecondaryAction action={item.iconAction} />}
      </div>
    );
  }

  if (item.type === 'submenu' && item.submenu) {
    return (
      <div className={skin.wrapper}>
        <DropdownMenuPrimitive.Sub>
          <DropdownMenuPrimitive.SubTrigger disabled={item.disabled} className={subTriggerClasses}>
            {rowContent}
          </DropdownMenuPrimitive.SubTrigger>
          <DropdownMenuPrimitive.Portal container={portalContainer ?? undefined}>
            <DropdownMenuPrimitive.SubContent
              sideOffset={4}
              // Confine flip/shift (and the available-height this menu sizes
              // itself by) to the owning surface — see `useCollisionBoundary`.
              collisionBoundary={collisionBoundary ?? undefined}
              collisionPadding={
                collisionBoundary ? COLLISION_PADDING_PX : withViewportPadding(undefined, viewportPadding)
              }
              hideWhenDetached
              className={cn(
                'z-[1500] max-h-[var(--radix-popper-available-height)] min-w-[256px] overflow-y-auto rounded-md border p-0 shadow-xl',
                skin.frame,
              )}
            >
              {item.submenu.map((subItem, index) => (
                <MenuItem key={subItem.id || index} item={subItem} onItemClick={onItemClick} />
              ))}
            </DropdownMenuPrimitive.SubContent>
          </DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Sub>
        {item.iconAction && <SecondaryAction action={item.iconAction} />}
      </div>
    );
  }

  return (
    <div className={skin.wrapper}>
      <div
        role={item.type === 'radio' ? 'menuitemradio' : 'menuitem'}
        aria-checked={item.type === 'radio' ? !!item.checked : undefined}
        tabIndex={item.disabled ? -1 : 0}
        aria-disabled={item.disabled}
        className={itemClasses}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={item.onHoverStart}
        onMouseLeave={item.onHoverEnd}
        // Focus previews a row only when the user moved it there (see `ActionsMenuItem.onHoverStart`).
        onFocus={() => {
          if (keyboardMoved?.current) item.onHoverStart?.();
        }}
        onBlur={item.onHoverEnd}
      >
        {rowContent}
      </div>
      {item.iconAction && <SecondaryAction action={item.iconAction} />}
    </div>
  );
};

/** The rows a keyboard moves between in an open menu: every enabled `menuitem` (plain, radio, submenu trigger). */
function menuRows(content: HTMLElement | null): HTMLElement[] {
  if (!content) return [];
  return [...content.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])')];
}

/** The menu-button keys (WAI-ARIA APG, "Menu Button"): ↓/↑ move between rows (wrapping), Home/End jump to the ends. */
const MENU_ROW_KEYS: Record<string, (index: number, count: number) => number> = {
  ArrowDown: (index, count) => (index + 1) % count,
  ArrowUp: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
};

const GroupSeparator: React.FC = () => <div className="h-[3px] w-full bg-ods-bg-surface" />;

export const ActionsMenu: React.FC<ActionsMenuProps> = ({
  groups,
  className = '',
  onItemClick,
  header,
  variant = 'default',
  scrollFade = false,
}) => {
  // A menu inside a dropdown keeps the dropdown's keyboard flag; one drawn on its own (a sheet) has none.
  const { keyboardMoved } = React.useContext(ActionsMenuRowContext);
  const rowContext = React.useMemo(() => ({ variant, keyboardMoved }), [variant, keyboardMoved]);
  return (
    <ActionsMenuRowContext.Provider value={rowContext}>
      <ActionsMenuFrame className={className} header={header} variant={variant} scrollFade={scrollFade}>
        {groups.map((group, groupIndex) => {
          const groupKey = group.id || group.items.map(i => i.id).join('|');
          return (
            <React.Fragment key={groupKey}>
              {group.items.map((item, itemIndex) => (
                <MenuItem key={item.id || `${groupKey}-${itemIndex}`} item={item} onItemClick={onItemClick} />
              ))}
              {group.separator && groupIndex < groups.length - 1 && <GroupSeparator />}
            </React.Fragment>
          );
        })}
      </ActionsMenuFrame>
    </ActionsMenuRowContext.Provider>
  );
};

/** The menu's box: its frame per variant, the optional header row, then the rows. */
function ActionsMenuFrame({
  className,
  header,
  variant,
  scrollFade,
  children,
}: {
  className: string;
  header: React.ReactNode;
  variant: ActionsMenuVariant;
  scrollFade: boolean;
  children: React.ReactNode;
}) {
  const { scrollRef, fadeTop, fadeBottom, update } = useScrollFade<HTMLDivElement>('vertical');
  const headerRow = header && (
    // The context strips the frame off controls that carry one (the view
    // TabSelector): inside the menu, the row border and the menu's own
    // rounding ARE the frame — see `actions-menu-header-context.ts`.
    <ActionsMenuHeaderContext.Provider value={true}>
      <div className="shrink-0 border-b border-ods-border">{header}</div>
    </ActionsMenuHeaderContext.Provider>
  );
  if (scrollFade) {
    return (
      <div
        className={cn(
          'relative flex max-h-[var(--radix-popper-available-height)] min-w-[256px] flex-col overflow-hidden rounded-md border shadow-lg',
          MENU_SKIN[variant].frame,
          className,
        )}
      >
        {headerRow}
        {/* The rows scroll here, under the frame's own border and rounding. `scroll-py-10` keeps a row the keyboard
            moves to clear of a fade. */}
        <div
          ref={scrollRef}
          onScroll={update}
          data-testid="actions-menu-rows"
          data-fade-top={fadeTop || undefined}
          data-fade-bottom={fadeBottom || undefined}
          className="min-h-0 flex-1 scroll-py-10 overflow-y-auto overscroll-y-contain"
          style={scrollFadeMask('vertical', fadeTop, fadeBottom)}
        >
          {children}
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        'relative max-h-[var(--radix-popper-available-height)] min-w-[256px] overflow-y-auto rounded-md border shadow-lg',
        MENU_SKIN[variant].frame,
        className,
      )}
    >
      {headerRow}
      {children}
    </div>
  );
}

export interface ActionsMenuDropdownProps extends ActionsMenuProps {
  trigger?: React.ReactNode;
  /** Replace the entire default trigger button. When set, rendered directly as the DropdownMenuTrigger child. */
  customTrigger?: React.ReactNode;
  triggerAriaLabel?: string;
  triggerClassName?: string;
  contentClassName?: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
  /** Controlled open state. Pair with `onOpenChange`. Uncontrolled by default. */
  open?: boolean;
  /** Open-state change handler (also fires when an item closes the menu). */
  onOpenChange?: (open: boolean) => void;
  /** Forwarded to the dropdown content — e.g. `e.preventDefault()` to stop
   *  Radix returning focus (and its focus ring) to the trigger on close. */
  onCloseAutoFocus?: (event: Event) => void;
  /** `false` keeps the menu on its `side` whatever room is there (its height still follows the room): a menu that
   *  opens up from a control above a composer must not flip down over it. Default: Radix's own (flip and shift). */
  avoidCollisions?: boolean;
  /** The menu's subject is still being read: the trigger (default or custom) is drawn for real and inert, and the menu
   *  cannot open. A loading scope does the same. */
  loading?: boolean;
}

export const ActionsMenuDropdown: React.FC<ActionsMenuDropdownProps> = ({
  groups,
  onItemClick,
  className,
  header,
  trigger,
  customTrigger,
  triggerAriaLabel = 'More actions',
  triggerClassName,
  contentClassName,
  align = 'end',
  side = 'bottom',
  sideOffset = 6,
  open: openProp,
  onOpenChange,
  onCloseAutoFocus,
  avoidCollisions,
  variant = 'default',
  scrollFade = false,
  loading: loadingProp = false,
}) => {
  // ONE switch: in a page's loading state (or while the host reads the menu's subject) the menu is its trigger's box.
  const loading = useLoadingScope() || loadingProp;
  const [open = false, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: false,
    onChange: onOpenChange,
  });

  // Tell the surrounding surface an overlay is open, so it can stop moving
  // the ground under it (the chat thread suspends its follow-the-bottom
  // auto-scroll — see `OverlayOpenRegistryProvider`). Inert without a
  // provider, so menus elsewhere are unaffected.
  useReportOverlayOpen(open);

  // Dismiss once the USER scrolls the trigger away.
  //
  // Two different situations, two different answers. Content moving on its own
  // (a streaming reply) is handled above by suspending the auto-scroll — the
  // menu must survive that, nobody asked for it to close. A deliberate scroll
  // is the opposite: the reader left, and an anchored menu would ride along
  // until it hovers over unrelated chrome. `hideWhenDetached` only kicks in
  // once the trigger is FULLY clipped, so a half-scrolled trigger still drags
  // a visible menu across the header.
  //
  // Scoped deliberately:
  //   • only scrolls of containers that actually contain the trigger — a
  //     scroll in a neighbouring column is none of our business;
  //   • only past `SCROLL_DISMISS_THRESHOLD_PX` of movement, so touch
  //     momentum and the ~1px settle after opening don't close the menu the
  //     user is reaching for.
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  // On open, focus goes to the first row (WAI-ARIA APG, "Menu Button"). The rows are not Radix items, so Radix only
  // focuses the menu itself; one frame later, once it has, the first row takes focus.
  // Whether a key was pressed inside the menu since it opened: the rows tell the focus the menu gives its first row
  // (below) from the focus the user moves, and only the second one previews a row (`onHoverStart`).
  const keyboardMoved = React.useRef(false);
  const rowContext = React.useMemo(() => ({ variant, keyboardMoved }), [variant]);
  React.useEffect(() => {
    if (!open) return undefined;
    keyboardMoved.current = false;
    const frame = requestAnimationFrame(() => menuRows(contentRef.current)[0]?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);
  React.useEffect(() => {
    if (!open) return undefined;
    if (typeof document === 'undefined') return undefined;
    const triggerEl = triggerRef.current;
    if (!triggerEl) return undefined;
    const anchorTop = triggerEl.getBoundingClientRect().top;
    const onScroll = (event: Event) => {
      const target = event.target as Node | null;
      // `document` fires for the page scroll and contains everything.
      const scrolledTheTrigger = target === document || (target instanceof Node && target.contains(triggerEl));
      if (!scrolledTheTrigger) return;
      const moved = Math.abs(triggerEl.getBoundingClientRect().top - anchorTop);
      if (moved > SCROLL_DISMISS_THRESHOLD_PX) setOpen(false);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [open, setOpen]);

  // Escape closes this menu and nothing else; the next one is the surface's (APG, "Menu Button"). Radix's own answer
  // reaches a dialog only when the two share a copy of its layer stack: where a host's tree holds two (the hub's), the
  // dialog's listener runs first, on the document, and closes the chat's panel with the menu inside it. So the menu hears
  // the key first, before the document does.
  const closedByEscape = React.useRef(false);
  React.useEffect(() => {
    if (!open || loading) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closedByEscape.current = true;
      setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [open, loading, setOpen]);

  const handleItemClick = useCallback(
    (item: ActionsMenuItem) => {
      onItemClick?.(item);
      if (item.type !== 'checkbox' && item.type !== 'submenu' && item.closeOnSelect !== false) {
        setOpen(false);
      }
    },
    [onItemClick, setOpen],
  );

  // The trigger is a static control: drawn for real in both forms, inert while the menu's subject loads.
  const triggerNode = customTrigger ?? (
    <Button
      variant="outline"
      size="icon"
      aria-label={triggerAriaLabel}
      className={
        triggerClassName ||
        'flex items-center justify-center border-ods-border bg-ods-card hover:bg-ods-bg-hover focus-visible:ring-0'
      }
      leftIcon={trigger ?? <Ellipsis01Icon size={24} className="text-ods-text-primary" />}
    />
  );

  if (loading) {
    // A custom trigger is the host's control (it switches itself in the scope, e.g. a field trigger). Either trigger is
    // drawn as it is, inert: it cannot open while the subject is read.
    return <InertWhileLoading>{triggerNode}</InertWhileLoading>;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild ref={triggerRef}>
        {triggerNode}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        ref={contentRef}
        align={align}
        side={side}
        sideOffset={sideOffset}
        // The rows are this menu's own, not Radix items, so Radix does not move between them: the menu-button
        // pattern's keys are done here, and the first row takes focus on open (the effect above).
        avoidCollisions={avoidCollisions}
        onKeyDownCapture={() => {
          keyboardMoved.current = true;
        }}
        onKeyDown={event => {
          const move = MENU_ROW_KEYS[event.key];
          if (!move) return;
          const rows = menuRows(contentRef.current);
          if (rows.length === 0) return;
          event.preventDefault();
          const current = rows.indexOf(document.activeElement as HTMLElement);
          rows[move(Math.max(current, 0), rows.length)]?.focus();
        }}
        // Closed by its key, focus goes back to the button whatever the host asks after a pointer: it is the keyboard's
        // way on, and in a panel that closes on Escape it is what lets the panel hear the next one. A trigger inside a
        // Tooltip shows its tooltip on that focus, as on any focus, for a mouse user too (the history section's two): there
        // the next Escape closes the tooltip and the one after it the panel. Decided to keep as ordinary keyboard behaviour.
        onCloseAutoFocus={event => {
          if (closedByEscape.current) closedByEscape.current = false;
          else onCloseAutoFocus?.(event);
        }}
        className={cn('overflow-visible border-0 bg-transparent p-0 shadow-none', contentClassName)}
      >
        <ActionsMenuRowContext.Provider value={rowContext}>
          <ActionsMenu
            groups={groups}
            onItemClick={handleItemClick}
            className={className}
            header={header}
            variant={variant}
            scrollFade={scrollFade}
          />
        </ActionsMenuRowContext.Provider>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ActionsMenu;
