'use client';

import { autoUpdate } from '@floating-ui/react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { useControllableState } from '@radix-ui/react-use-controllable-state';
import { Check } from 'lucide-react';
import React, { useCallback } from 'react';
import Link from '../../embed-shims/next-link';
import { useMdUp } from '../../hooks/ui/use-media-query';
import { useViewportCollisionPadding, withViewportPadding } from '../../hooks/ui/use-viewport-collision-padding';
import { cn } from '../../utils/cn';
import { CheckFillIcon, Chevron02LeftIcon, Chevron02RightIcon } from '../icons-v2-generated';
import { ActionsMenuHeaderContext } from './actions-menu-header-context';
import { ActionsMenuTriggerButton } from './actions-menu-trigger';
import { Button } from './button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './dropdown-menu';
import { InertWhileLoading, useLoadingScope } from './loading-scope';
import { useReportOverlayOpen } from './overlay-open-registry';
import { COLLISION_PADDING_PX, useCollisionBoundary, usePortalContainer } from './portal-container';
import { scrollFadeMask, useScrollFade } from './scroll-fade';

/** Trigger movement (px) that counts as "the user scrolled away" rather than
 *  touch-momentum jitter or the sub-pixel settle right after opening. */
const SCROLL_DISMISS_THRESHOLD_PX = 12;
const VIEWPORT_MENU_GUTTER_PX = 16;
const COMPARISON_TOP_INSET_PX = 64;
const COMPARISON_ROW_HEIGHT_PX = 56;
const DRILL_DOWN_HEADER_HEIGHT_PX = 48;
const POPUP_AVAILABLE_HEIGHT = 'var(--radix-popper-available-height)';

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
  /** Replaces the visual text body. Keep label and description for assistive technology. */
  content?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /**
   * `checkbox`: one of many options, a box, the menu stays open. `radio`: one
   * option of a set (a choice, not a toggle) — a check on the chosen one, the
   * menu closes on a pick. `submenu`: the chosen option is inside it, a check before its chevron.
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
  /** Under a submenu's rows, in place while they scroll (e.g. a note about the choices). */
  footer?: React.ReactNode;
  /** Submenu placement boundary, inherited by descendants. Defaults to the owning surface. */
  submenuBoundary?: 'surface' | 'viewport';
  /** Width in pixels for a viewport submenu aligned to the bottom of its parent menu. */
  submenuWidth?: number;
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
  /** Fixed content below the scrolling rows. */
  footer?: React.ReactNode;
}

interface ActionsMenuRowContextValue {
  variant: ActionsMenuVariant;
  /** True once a key was pressed inside the open menu: focus that moves after it was moved by the user. */
  keyboardMoved?: React.RefObject<boolean>;
  navigate?: (item: ActionsMenuItem) => void;
  mobileDrillDown?: boolean;
}

/** What a menu's rows read from the menu they are in (a submenu's rows included). */
const ActionsMenuRowContext = React.createContext<ActionsMenuRowContextValue>({ variant: 'default' });

interface OpenSubmenu {
  depth: number;
  close: () => void;
}

const OpenSubmenusContext = React.createContext<Map<string, OpenSubmenu> | null>(null);

interface MenuItemProps {
  item: ActionsMenuItem;
  onItemClick?: (item: ActionsMenuItem) => void;
  depth?: number;
  submenuBoundary?: 'surface' | 'viewport';
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

const INITIAL_SUBMENU_PLACEMENT = { sideOffset: 4, alignOffset: 0, maxWidth: undefined, maxHeight: undefined } as {
  sideOffset: number;
  alignOffset: number;
  maxWidth?: number;
  maxHeight?: number;
};

function useViewportSubmenuPlacement(
  trigger: React.RefObject<HTMLDivElement | null>,
  content: HTMLDivElement | null,
  width: number | undefined,
  safeTop: number,
) {
  const [placement, setPlacement] = React.useState(INITIAL_SUBMENU_PLACEMENT);
  React.useLayoutEffect(() => {
    const anchor = trigger.current;
    if (!anchor || !content) return undefined;
    const viewport = window.visualViewport;
    const measure = () => {
      const bounds = anchor.getBoundingClientRect();
      const left = viewport?.offsetLeft ?? 0;
      const right = left + (viewport?.width ?? document.documentElement.clientWidth);
      const space = Math.max(bounds.left - left, right - bounds.right);
      const parent = width !== undefined ? anchor.closest('[role="menu"]') : null;
      const bottom = parent?.getBoundingClientRect().bottom;
      const maxHeight =
        bottom === undefined ? undefined : Math.max(0, bottom - Math.max(COMPARISON_TOP_INSET_PX, safeTop));
      const next = {
        sideOffset: width === undefined ? Math.min(4, space - content.getBoundingClientRect().width) : 4,
        alignOffset:
          bottom === undefined || maxHeight === undefined
            ? 0
            : bottom - bounds.top - Math.min(content.offsetHeight, maxHeight),
        maxWidth: width === undefined ? undefined : Math.max(0, Math.min(width, space - 4 - VIEWPORT_MENU_GUTTER_PX)),
        maxHeight,
      };
      setPlacement(previous =>
        previous.sideOffset === next.sideOffset &&
        previous.alignOffset === next.alignOffset &&
        previous.maxWidth === next.maxWidth &&
        previous.maxHeight === next.maxHeight
          ? previous
          : next,
      );
    };
    return autoUpdate(anchor, content, measure);
  }, [trigger, content, width, safeTop]);
  return placement;
}

const MenuItem: React.FC<MenuItemProps> = ({ item, onItemClick, depth = 0, submenuBoundary = 'surface' }) => {
  // Submenus below portal + collide against the OWNING surface, matching the
  // root menu (`DropdownMenuContent`). Read unconditionally — hooks first.
  const portalContainer = usePortalContainer();
  const collisionBoundary = useCollisionBoundary();
  const viewportPadding = useViewportCollisionPadding();
  const { variant, keyboardMoved, navigate, mobileDrillDown } = React.useContext(ActionsMenuRowContext);
  const skin = MENU_SKIN[variant];
  const comparisonSubmenu = item.submenuWidth !== undefined;
  const boundary = comparisonSubmenu ? 'viewport' : (item.submenuBoundary ?? submenuBoundary);
  const viewport = boundary === 'viewport';
  const customContent = item.content != null;
  const [subOpen, setSubOpen] = React.useState(false);
  const submenuKeyboardMoved = React.useRef(false);
  const submenuRowContext = React.useMemo(
    () => ({ variant, keyboardMoved: submenuKeyboardMoved, mobileDrillDown }),
    [variant, mobileDrillDown],
  );
  React.useEffect(() => {
    if (!subOpen) submenuKeyboardMoved.current = false;
  }, [subOpen]);
  const subTriggerRef = React.useRef<HTMLDivElement>(null);
  const [subContent, setSubContent] = React.useState<HTMLDivElement | null>(null);
  const viewportPlacement = useViewportSubmenuPlacement(
    subTriggerRef,
    subContent,
    item.submenuWidth,
    viewportPadding.top,
  );
  const submenuId = React.useId();
  const openSubmenus = React.useContext(OpenSubmenusContext);
  React.useEffect(() => {
    if (!subOpen || !openSubmenus) return undefined;
    openSubmenus.set(submenuId, {
      depth,
      close: () => {
        setSubOpen(false);
        subTriggerRef.current?.focus();
      },
    });
    return () => {
      openSubmenus.delete(submenuId);
    };
  }, [subOpen, openSubmenus, submenuId, depth]);
  const registerRow = (row: React.ReactElement) =>
    depth > 0 ? (
      <DropdownMenuPrimitive.Item asChild disabled={item.disabled} onSelect={event => event.preventDefault()}>
        {row}
      </DropdownMenuPrimitive.Item>
    ) : (
      row
    );
  const activate = useCallback(() => {
    if (item.disabled) return;
    if (item.type === 'checkbox') {
      item.onClick?.();
      onItemClick?.(item);
      return;
    }
    if (item.type === 'submenu') {
      if (item.submenu) navigate?.(item);
      return;
    }
    item.onClick?.();
    onItemClick?.(item);
  }, [item, navigate, onItemClick]);

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
      if (e.key !== 'Enter' && e.key !== ' ' && !(e.key === 'ArrowRight' && navigate && item.type === 'submenu'))
        return;
      e.preventDefault();
      e.stopPropagation();
      activate();
    },
    [activate, item.type, navigate],
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
    item.disabled
      ? cn('pointer-events-none cursor-not-allowed text-ods-text-secondary', !mobileDrillDown && 'opacity-60')
      : skin.rowIdle,
    mobileDrillDown && 'min-h-0 pr-[var(--spacing-system-xsf)]',
    customContent && 'gap-[var(--spacing-system-sf)] py-[var(--spacing-system-xxs)]',
  );

  const wrapperClasses = cn(skin.wrapper, mobileDrillDown && 'min-h-10', customContent && 'min-h-14');
  const subTriggerClasses = cn(itemClasses, skin.rowOpen, comparisonSubmenu && 'data-[state=open]:bg-ods-bg-surface');
  const labelClasses = cn(
    mobileDrillDown
      ? 'min-w-0 flex-1 font-body text-[length:var(--font-size-menu-label)] font-medium leading-[var(--font-line-space-menu-label)]'
      : skin.label,
    item.disabled
      ? mobileDrillDown
        ? 'text-ods-text-panel-secondary'
        : 'text-ods-text-secondary'
      : item.danger
        ? 'text-ods-error'
        : 'text-ods-text-primary',
  );

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

      {customContent ? (
        <div className="min-w-0 flex-1">{item.content}</div>
      ) : item.description ? (
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={labelClasses}>{item.label}</span>
          <span className="text-ods-text-secondary text-h6">{item.description}</span>
        </span>
      ) : (
        <span className={labelClasses}>{item.label}</span>
      )}

      {item.type === 'radio' && customContent ? (
        <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden>
          {item.checked && <CheckFillIcon size={20} className="text-ods-accent" />}
        </span>
      ) : item.type === 'submenu' && comparisonSubmenu && item.checked ? (
        <CheckFillIcon size={20} className="shrink-0 text-ods-accent" aria-hidden />
      ) : (item.type === 'radio' || item.type === 'submenu') && item.checked ? (
        <Check className="h-4 w-4 shrink-0 text-ods-accent md:h-6 md:w-6" strokeWidth={3} aria-hidden="true" />
      ) : null}

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

      {item.type === 'submenu' && (
        <Chevron02RightIcon
          className={
            comparisonSubmenu ? 'size-5 text-ods-text-panel-secondary' : 'h-4 w-4 text-ods-text-secondary md:h-6 md:w-6'
          }
          aria-hidden
        />
      )}
    </>
  );

  if (renderAsLink && item.href) {
    return (
      <div className={wrapperClasses}>
        {registerRow(
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
          </Link>,
        )}
        {item.iconAction && <SecondaryAction action={item.iconAction} />}
      </div>
    );
  }

  if (item.type === 'submenu' && item.submenu && !navigate) {
    const availableHeight =
      viewportPlacement.maxHeight === undefined
        ? POPUP_AVAILABLE_HEIGHT
        : `min(${viewportPlacement.maxHeight}px, ${POPUP_AVAILABLE_HEIGHT})`;
    const submenuRows = item.submenu.map((subItem, index) => (
      <MenuItem
        key={subItem.id || index}
        item={subItem}
        onItemClick={onItemClick}
        depth={depth + 1}
        submenuBoundary={boundary}
      />
    ));
    return (
      <div className={wrapperClasses}>
        <DropdownMenuPrimitive.Sub open={subOpen} onOpenChange={setSubOpen}>
          <DropdownMenuPrimitive.SubTrigger
            ref={subTriggerRef}
            disabled={item.disabled}
            aria-current={item.checked || undefined}
            className={subTriggerClasses}
            onPointerLeave={event => {
              if (
                viewport &&
                subOpen &&
                event.relatedTarget instanceof Node &&
                subContent?.contains(event.relatedTarget)
              )
                event.preventDefault();
            }}
          >
            {rowContent}
          </DropdownMenuPrimitive.SubTrigger>
          <DropdownMenuPrimitive.Portal container={viewport ? undefined : (portalContainer ?? undefined)}>
            <DropdownMenuPrimitive.SubContent
              ref={viewport ? setSubContent : undefined}
              sideOffset={viewport ? viewportPlacement.sideOffset : 4}
              alignOffset={comparisonSubmenu ? viewportPlacement.alignOffset : undefined}
              onKeyDownCapture={() => {
                submenuKeyboardMoved.current = true;
              }}
              onPointerMoveCapture={() => {
                submenuKeyboardMoved.current = false;
              }}
              // Confine flip/shift (and the available-height this menu sizes
              // itself by) to the owning surface — see `useCollisionBoundary`.
              collisionBoundary={viewport ? undefined : (collisionBoundary ?? undefined)}
              collisionPadding={
                !viewport && collisionBoundary
                  ? COLLISION_PADDING_PX
                  : withViewportPadding(comparisonSubmenu ? VIEWPORT_MENU_GUTTER_PX : undefined, viewportPadding)
              }
              hideWhenDetached
              className={cn(
                'z-[1500] max-h-[var(--radix-popper-available-height)] rounded-md border p-0 shadow-xl',
                item.footer ? 'flex flex-col overflow-hidden' : 'overflow-y-auto',
                comparisonSubmenu
                  ? undefined
                  : viewport
                    ? 'min-w-[min(256px,calc((100vw-var(--spacing-system-mf)*3)/2))] max-w-[calc((100vw-var(--spacing-system-mf)*3)/2)]'
                    : 'min-w-[256px]',
                skin.frame,
              )}
              style={
                comparisonSubmenu
                  ? {
                      width: viewportPlacement.maxWidth ?? item.submenuWidth,
                      maxHeight: availableHeight,
                    }
                  : undefined
              }
            >
              <ActionsMenuRowContext.Provider value={submenuRowContext}>
                {item.footer ? (
                  <>
                    <div
                      data-testid="actions-menu-submenu-rows"
                      className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
                    >
                      {submenuRows}
                    </div>
                    {comparisonSubmenu ? (
                      <ComparisonMenuFooter availableHeight={availableHeight}>{item.footer}</ComparisonMenuFooter>
                    ) : (
                      <div className="shrink-0 border-t border-ods-border">{item.footer}</div>
                    )}
                  </>
                ) : (
                  submenuRows
                )}
              </ActionsMenuRowContext.Provider>
            </DropdownMenuPrimitive.SubContent>
          </DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Sub>
        {item.iconAction && <SecondaryAction action={item.iconAction} />}
      </div>
    );
  }

  return (
    <div className={wrapperClasses}>
      {registerRow(
        <div
          role={item.type === 'radio' ? 'menuitemradio' : 'menuitem'}
          aria-checked={item.type === 'radio' ? !!item.checked : undefined}
          aria-current={item.type === 'submenu' ? item.checked || undefined : undefined}
          aria-label={customContent ? item.label : undefined}
          aria-description={customContent ? item.description : undefined}
          data-menu-item-id={navigate ? item.id : undefined}
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
        </div>,
      )}
      {item.iconAction && <SecondaryAction action={item.iconAction} />}
    </div>
  );
};

/** The rows a keyboard moves between in an open menu: every enabled `menuitem` (plain, radio, submenu trigger). */
function menuRows(content: HTMLElement | null): HTMLElement[] {
  if (!content) return [];
  return [...content.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])')];
}

function ComparisonMenuFooter({
  availableHeight = POPUP_AVAILABLE_HEIGHT,
  reserveHeader = false,
  children,
}: {
  availableHeight?: string;
  reserveHeader?: boolean;
  children: React.ReactNode;
}) {
  const footerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const footer = footerRef.current;
    const menu = footer?.closest<HTMLElement>('[role="menu"]');
    if (!footer || !menu) return undefined;

    let previousModel: HTMLElement | undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.closest('[role="menu"]') !== menu) return;
      if (target === footer && (event.key === 'Home' || event.key === 'End')) {
        event.preventDefault();
        event.stopPropagation();
        footer.scrollTop = event.key === 'Home' ? 0 : footer.scrollHeight;
        return;
      }
      if (event.key !== 'Tab') return;
      if (target === footer && event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        (previousModel?.isConnected ? previousModel : menuRows(menu)[0])?.focus();
      } else if (
        !event.shiftKey &&
        target.getAttribute('role') === 'menuitemradio' &&
        footer.clientHeight > 0 &&
        footer.scrollHeight > footer.clientHeight
      ) {
        event.preventDefault();
        event.stopPropagation();
        previousModel = target;
        footer.focus();
      }
    };
    // The popup's Radix handlers suppress Tab. Take only the keys owned by the overflowed notes.
    menu.addEventListener('keydown', handleKeyDown, true);
    return () => menu.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Two frame borders, one complete option, and the mobile Back row with its divider.
  const reservedHeight = COMPARISON_ROW_HEIGHT_PX + 2 + (reserveHeader ? DRILL_DOWN_HEADER_HEIGHT_PX + 1 : 0);
  return (
    <div
      ref={footerRef}
      role="group"
      aria-label="Menu notes"
      tabIndex={-1}
      className="shrink-0 overflow-y-auto overscroll-y-contain border-t border-ods-border"
      style={{ maxHeight: `max(0px, calc(${availableHeight} - ${reservedHeight}px))` }}
    >
      {children}
    </div>
  );
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
  footer,
}) => {
  // A menu inside a dropdown keeps the dropdown's keyboard flag; one drawn on its own (a sheet) has none.
  const parentContext = React.useContext(ActionsMenuRowContext);
  const rowContext = React.useMemo(() => ({ ...parentContext, variant }), [parentContext, variant]);
  return (
    <ActionsMenuRowContext.Provider value={rowContext}>
      <ActionsMenuFrame className={className} header={header} variant={variant} scrollFade={scrollFade} footer={footer}>
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
  footer,
  children,
}: {
  className: string;
  header: React.ReactNode;
  variant: ActionsMenuVariant;
  scrollFade: boolean;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const { scrollRef, fadeTop, fadeBottom, update } = useScrollFade<HTMLDivElement>('vertical');
  const { navigate } = React.useContext(ActionsMenuRowContext);
  const headerRow = header && (
    // The context strips the frame off controls that carry one (the view
    // TabSelector): inside the menu, the row border and the menu's own
    // rounding ARE the frame — see `actions-menu-header-context.ts`.
    <ActionsMenuHeaderContext.Provider value={true}>
      <div className="shrink-0 border-b border-ods-border">{header}</div>
    </ActionsMenuHeaderContext.Provider>
  );
  if (scrollFade || footer || (navigate && header)) {
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
          style={scrollFade ? scrollFadeMask('vertical', fadeTop, fadeBottom) : undefined}
        >
          {children}
        </div>
        {footer &&
          (navigate ? (
            <ComparisonMenuFooter reserveHeader={Boolean(header)}>{footer}</ComparisonMenuFooter>
          ) : (
            <div className="shrink-0 border-t border-ods-border">{footer}</div>
          ))}
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
  /** Below the tablet breakpoint, open a submenu as a new page of this menu. */
  mobileDrillDown?: boolean;
}

export const ActionsMenuDropdown: React.FC<ActionsMenuDropdownProps> = ({
  groups,
  onItemClick,
  className,
  header,
  footer,
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
  mobileDrillDown = false,
  loading: loadingProp = false,
}) => {
  // ONE switch: in a page's loading state (or while the host reads the menu's subject) the menu is its trigger's box.
  const loading = useLoadingScope() || loadingProp;
  const [open = false, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: false,
    onChange: onOpenChange,
  });
  const mobile = useMdUp() === false && mobileDrillDown;
  const previousMobile = React.useRef(mobile);
  const [mobilePath, setMobilePath] = React.useState<string[]>([]);
  const nextFocus = React.useRef<string | null>(null);
  const viewportPadding = useViewportCollisionPadding();
  const [mobileOffset, setMobileOffset] = React.useState(0);
  const pages = (mobile && open ? mobilePath : []).reduce<ActionsMenuItem[]>((visible, id, index) => {
    const parentItems = index === 0 ? groups.flatMap(group => group.items) : visible[index - 1]?.submenu;
    const page = parentItems?.find(item => item.id === id && item.submenu);
    return page ? [...visible, page] : visible;
  }, []);
  const page = pages[pages.length - 1];
  if ((!open || !mobile) && mobilePath.length > 0) setMobilePath([]);

  const back = useCallback(() => {
    nextFocus.current = page?.id ?? null;
    setMobilePath(current => current.slice(0, Math.max(0, pages.length - 1)));
  }, [page?.id, pages.length]);
  const navigate = useCallback(
    (item: ActionsMenuItem) => {
      nextFocus.current = null;
      setMobilePath(current => [...current.slice(0, pages.length), item.id]);
    },
    [pages.length],
  );

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
  const [mobileContent, setMobileContent] = React.useState<HTMLDivElement | null>(null);
  const captureMobileContent = useCallback((content: HTMLDivElement | null) => {
    contentRef.current = content;
    setMobileContent(content);
  }, []);
  React.useLayoutEffect(() => {
    if (previousMobile.current === mobile) return;
    previousMobile.current = mobile;
    if (open) setOpen(false);
  }, [mobile, open, setOpen]);

  React.useLayoutEffect(() => {
    const triggerEl = triggerRef.current;
    if (!mobile || !open || !triggerEl || !mobileContent) return undefined;
    // The Radix portal can mount after the open state is committed.
    return autoUpdate(triggerEl, mobileContent, () => {
      setMobileOffset(
        (window.visualViewport?.offsetLeft ?? 0) + VIEWPORT_MENU_GUTTER_PX - triggerEl.getBoundingClientRect().left,
      );
    });
  }, [mobile, open, mobileContent]);
  // On open, focus goes to the first row (WAI-ARIA APG, "Menu Button"). The rows are not Radix items, so Radix only
  // focuses the menu itself; one frame later, once it has, the first row takes focus.
  // Whether a key was pressed inside the menu since it opened: the rows tell the focus the menu gives its first row
  // (below) from the focus the user moves, and only the second one previews a row (`onHoverStart`).
  const keyboardMoved = React.useRef(false);
  const rowContext = React.useMemo(
    () => ({ variant, keyboardMoved, mobileDrillDown, navigate: mobile ? navigate : undefined }),
    [variant, mobile, mobileDrillDown, navigate],
  );
  React.useEffect(() => {
    if (!open) {
      nextFocus.current = null;
      return undefined;
    }
    keyboardMoved.current = false;
    const frame = requestAnimationFrame(() => {
      const rows = menuRows(contentRef.current);
      const requested = rows.find(row => row.dataset.menuItemId === nextFocus.current);
      (requested ?? rows[0])?.focus();
      nextFocus.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [open, page?.id]);
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
  const openSubmenus = React.useMemo(() => new Map<string, OpenSubmenu>(), []);
  React.useEffect(() => {
    if (!open || loading) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      const deepest = [...openSubmenus.values()].sort((a, b) => b.depth - a.depth)[0];
      if (page) back();
      else if (deepest) deepest.close();
      else {
        closedByEscape.current = true;
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [open, loading, setOpen, openSubmenus, page, back]);

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
    <ActionsMenuTriggerButton
      trigger={trigger}
      triggerAriaLabel={triggerAriaLabel}
      triggerClassName={triggerClassName}
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
        ref={mobile ? captureMobileContent : contentRef}
        align={mobile ? 'start' : align}
        alignOffset={mobile ? mobileOffset : undefined}
        side={side}
        sideOffset={sideOffset}
        collisionBoundary={mobile ? [] : undefined}
        collisionPadding={
          mobile
            ? withViewportPadding(
                {
                  top: COMPARISON_TOP_INSET_PX,
                  right: VIEWPORT_MENU_GUTTER_PX,
                  bottom: VIEWPORT_MENU_GUTTER_PX,
                  left: VIEWPORT_MENU_GUTTER_PX,
                },
                viewportPadding,
              )
            : undefined
        }
        // The rows are this menu's own, not Radix items, so Radix does not move between them: the menu-button
        // pattern's keys are done here, and the first row takes focus on open (the effect above).
        avoidCollisions={avoidCollisions}
        onKeyDownCapture={() => {
          keyboardMoved.current = true;
        }}
        onKeyDown={event => {
          if (event.defaultPrevented || event.currentTarget !== (event.target as HTMLElement).closest('[role="menu"]'))
            return;
          if (event.key === 'ArrowLeft' && page) {
            event.preventDefault();
            back();
            return;
          }
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
        className={cn(
          'overflow-visible border-0 bg-transparent p-0 shadow-none',
          mobile && 'min-w-0',
          contentClassName,
        )}
        style={mobile ? { width: 'calc(100dvw - var(--spacing-system-mf) * 2)' } : undefined}
      >
        <OpenSubmenusContext.Provider value={openSubmenus}>
          <ActionsMenuRowContext.Provider value={rowContext}>
            <ActionsMenu
              groups={page?.submenu ? [{ items: page.submenu }] : groups}
              onItemClick={handleItemClick}
              className={cn(className, mobile && 'w-full min-w-0')}
              header={
                page ? (
                  <Button
                    variant="row"
                    type="button"
                    role="menuitem"
                    aria-label={`Back to providers from ${page.label}`}
                    className="min-h-12 gap-[var(--spacing-system-xsf)] rounded-none bg-ods-bg-base px-[var(--spacing-system-xsf)] text-ods-text-panel-secondary"
                    onClick={back}
                  >
                    <Chevron02LeftIcon aria-hidden size={24} />
                    <span className="truncate font-body text-[length:var(--font-size-menu-heading)] font-medium leading-[var(--font-line-space-menu-heading)]">
                      {page.label}
                    </span>
                  </Button>
                ) : (
                  header
                )
              }
              variant={variant}
              scrollFade={scrollFade}
              footer={page ? page.footer : footer}
            />
          </ActionsMenuRowContext.Provider>
        </OpenSubmenusContext.Provider>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ActionsMenu;
