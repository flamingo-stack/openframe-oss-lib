'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type RefCallback,
} from 'react';

export interface UseNavMenusOptions {
  /** The host router's pathname: any change closes the open menu. */
  pathname: string;
  /** Hover intent: how long the pointer rests on a trigger before it opens. */
  hoverOpenMs?: number;
  /** How long after the pointer left the trigger and the panel the menu closes. */
  hoverCloseMs?: number;
}

/** A click this soon after a hover switched menus is the same tap, not a second gesture. */
const TAP_AFTER_HOVER_MS = 400;

export interface NavMenuTriggerProps {
  ref: RefCallback<HTMLElement>;
  'aria-expanded': boolean;
  'aria-controls': string;
  onClick: (event: ReactMouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export interface NavMenuPanelProps {
  ref: RefCallback<HTMLElement>;
  id: string;
  inert: boolean;
  'data-state': 'open' | 'closed';
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export interface UseNavMenusResult {
  /** The id of the open menu, or `null`. One menu is open at a time. */
  openId: string | null;
  close: () => void;
  getTriggerProps: (id: string) => NavMenuTriggerProps;
  getPanelProps: (id: string) => NavMenuPanelProps;
}

/**
 * Open state for a row of disclosure menus (the site header's dropdowns and
 * mega menus).
 *
 * - Click toggles; the trigger is a `<button>`, so Enter and Space arrive as
 *   that same click.
 * - Hover on a trigger opens after `hoverOpenMs`; with a menu already open,
 *   hovering another trigger switches to it at once. Leaving the trigger and the
 *   panel closes after `hoverCloseMs`; entering the panel or any trigger
 *   cancels that close, so the pointer can cross the gap between them.
 * - Escape closes and returns focus to the trigger. A pointer-down outside
 *   every trigger and panel closes. A `pathname` change closes.
 * - No arrow-key roving: these are plain disclosures, Tab moves in DOM order.
 */
export function useNavMenus({
  pathname,
  hoverOpenMs = 150,
  hoverCloseMs = 300,
}: UseNavMenusOptions): UseNavMenusResult {
  const baseId = useId();
  // The open menu is remembered WITH the pathname it was opened on, so a
  // navigation closes it during render: no effect, no frame of a stale panel.
  // The stale entry is dropped in the same render, or coming back to that
  // pathname would reopen it.
  const [opened, setOpened] = useState<{ id: string; pathname: string } | null>(null);
  const stale = opened !== null && opened.pathname !== pathname;
  if (stale) setOpened(null);
  const openId = opened && !stale ? opened.id : null;

  const triggers = useRef(new Map<string, HTMLElement>());
  const panels = useRef(new Map<string, HTMLElement>());
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The last switch a hover made between open menus, for the tap rule in `onClick`.
  const hoverSwitch = useRef<{ id: string; at: number } | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const close = useCallback(() => {
    clearTimers();
    setOpened(null);
  }, [clearTimers]);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const scheduleClose = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = null;
    cancelClose();
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setOpened(null);
    }, hoverCloseMs);
  }, [cancelClose, hoverCloseMs]);

  useEffect(() => {
    if (!openId) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const trigger = triggers.current.get(openId);
      close();
      trigger?.focus({ preventScroll: true });
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      for (const el of triggers.current.values()) if (el.contains(target)) return;
      for (const el of panels.current.values()) if (el.contains(target)) return;
      close();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [openId, close]);

  const getTriggerProps = useCallback(
    (id: string): NavMenuTriggerProps => ({
      ref: el => {
        if (el) triggers.current.set(id, el);
        else triggers.current.delete(id);
      },
      'aria-expanded': openId === id,
      'aria-controls': `${baseId}-panel-${id}`,
      onClick: () => {
        // A touch tap fires mouseenter first: drop its pending open, or it
        // would reopen the menu this click just closed.
        clearTimers();
        // ...and when that mouseenter already switched to this menu, the click
        // is the same tap finishing: it must not toggle the menu shut again.
        const switched = hoverSwitch.current;
        hoverSwitch.current = null;
        if (switched && switched.id === id && Date.now() - switched.at < TAP_AFTER_HOVER_MS) {
          setOpened({ id, pathname });
          return;
        }
        setOpened(prev => (prev && prev.id === id && prev.pathname === pathname ? null : { id, pathname }));
      },
      onMouseEnter: () => {
        clearTimers();
        if (openId === id) return;
        // A menu is already open: the visitor is browsing the row, so the next
        // one opens at once. The hover-intent wait is only for the FIRST open
        // (it filters a pointer merely crossing the bar).
        if (openId !== null) {
          hoverSwitch.current = { id, at: Date.now() };
          setOpened({ id, pathname });
          return;
        }
        openTimer.current = setTimeout(() => {
          openTimer.current = null;
          setOpened({ id, pathname });
        }, hoverOpenMs);
      },
      onMouseLeave: scheduleClose,
    }),
    [baseId, openId, pathname, hoverOpenMs, clearTimers, scheduleClose],
  );

  const getPanelProps = useCallback(
    (id: string): NavMenuPanelProps => ({
      ref: el => {
        if (el) panels.current.set(id, el);
        else panels.current.delete(id);
      },
      id: `${baseId}-panel-${id}`,
      inert: openId !== id,
      'data-state': openId === id ? 'open' : 'closed',
      onMouseEnter: cancelClose,
      onMouseLeave: scheduleClose,
    }),
    [baseId, openId, cancelClose, scheduleClose],
  );

  return { openId, close, getTriggerProps, getPanelProps };
}
