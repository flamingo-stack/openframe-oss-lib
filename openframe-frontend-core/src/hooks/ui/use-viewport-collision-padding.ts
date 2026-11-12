'use client';

import { useSyncExternalStore } from 'react';

/**
 * The `collisionPadding` (px) a Radix popper needs to stay clear of what the
 * mobile shell draws over the page: the status bar at the top and the software
 * keyboard at the bottom. `{ top: 0, bottom: 0 }` on the web and on desktop.
 *
 * Radix positions every popper with floating-ui at `strategy: 'fixed'`, and
 * floating-ui takes its collision viewport from `window.visualViewport`. In the
 * mobile shell that box is the whole screen, and neither edge is free:
 *
 * - **Top.** The shell draws edge-to-edge (`viewport-fit=cover`), so the status
 *   bar lies over the first `--native-safe-top` px. A list that flips above its
 *   trigger stretches up to the screen's edge, and its first row sits under the
 *   clock and battery, where a tap does not reach it.
 * - **Bottom.** Neither shell shrinks the box a keyboard opens into: iOS runs
 *   Capacitor's Keyboard plugin at `resize: 'none'`, which leaves the WKWebView
 *   frame alone, and Android's window is edge-to-edge, where the IME is only a
 *   WindowInsets type. So `flip`/`shift`/`size` all believe the screen still
 *   reaches the bottom, and a dropdown whose own search field just raised the
 *   keyboard is placed straight behind it — worst inside modals, which sit near
 *   the bottom of the screen by design.
 *
 * The shell publishes both on <html>: the status bar as `--native-safe-top`
 * (openframe-frontend's `native-shell.ts`) and the keyboard as
 * `--of-keyboard-inset` (its `keyboard-inset.ts`). Both are unset everywhere
 * else, hence the 0 defaults.
 *
 * ```tsx
 * const collisionPadding = useViewportCollisionPadding()
 * <PopoverPrimitive.Content collisionPadding={collisionPadding} />
 * ```
 *
 * Pair it with `max-h-[var(--radix-popper-available-height)]` on the content:
 * padding alone flips a dropdown above its trigger, but a list taller than what
 * is left between the status bar and the keyboard would then spill over one of
 * them.
 */
export interface ViewportCollisionPadding {
  readonly top: number;
  readonly bottom: number;
}

const SAFE_TOP_VAR = '--native-safe-top';
const KEYBOARD_INSET_VAR = '--of-keyboard-inset';

function readPx(style: CSSStyleDeclaration, name: string): number {
  const value = Number.parseFloat(style.getPropertyValue(name));
  // Also catches the NaN of an unset variable.
  return value > 0 ? value : 0;
}

function measureBottom(style: CSSStyleDeclaration): number {
  const inset = readPx(style, KEYBOARD_INSET_VAR);
  if (inset === 0) return 0;
  // How far floating-ui's own viewport bottom sits below the top of the
  // keyboard. iOS reports the keyboard on the visual viewport and Android does
  // not; measuring the difference rather than branching on the platform keeps
  // both correct and can never reserve the same keyboard twice.
  const layoutHeight = document.documentElement.clientHeight;
  const viewport = window.visualViewport;
  const viewportBottom = viewport ? viewport.offsetTop + viewport.height : layoutHeight;
  return Math.max(0, Math.round(viewportBottom - (layoutHeight - inset)));
}

const NONE: ViewportCollisionPadding = { top: 0, bottom: 0 };

function measure(): ViewportCollisionPadding {
  if (typeof document === 'undefined') return NONE;
  const style = getComputedStyle(document.documentElement);
  return { top: Math.round(readPx(style, SAFE_TOP_VAR)), bottom: measureBottom(style) };
}

// One document-wide subscription for every popper on the page: both insets are
// globals, and each open dropdown re-reading them would mean another
// MutationObserver plus a forced style resolve per keystroke-driven re-render.
const listeners = new Set<() => void>();
let padding: ViewportCollisionPadding = NONE;
let teardown: (() => void) | null = null;

// The snapshot keeps its identity until a value changes: useSyncExternalStore
// compares it by reference, and the poppers hand it to Radix as is.
function sync(): void {
  const next = measure();
  if (next.top === padding.top && next.bottom === padding.bottom) return;
  padding = next;
  for (const notify of listeners) notify();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  if (listeners.size === 1) {
    sync();
    // Two independent signals. Both insets land on <html>'s inline style, so the
    // attribute is the only notification for them; the visual viewport moves on
    // its own schedule (iOS reports the keyboard there, and a pinch-zoom shifts
    // it with no keyboard involved at all) and changes what is left to reserve.
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', sync);
    viewport?.addEventListener('scroll', sync);
    teardown = () => {
      observer.disconnect();
      viewport?.removeEventListener('resize', sync);
      viewport?.removeEventListener('scroll', sync);
    };
  }
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size > 0) return;
    teardown?.();
    teardown = null;
  };
}

type Side = 'top' | 'right' | 'bottom' | 'left';
export type CollisionPadding = number | Partial<Record<Side, number>>;

/**
 * A popper's own `collisionPadding` with the viewport's added, side by side, whichever is larger. Only for a popper
 * that collides against the viewport: a published collision boundary (a panel inside the app shell) already ends
 * below the status bar and above the keyboard.
 */
export function withViewportPadding(
  own: CollisionPadding | undefined,
  viewport: ViewportCollisionPadding,
): Partial<Record<Side, number>> {
  const side = (name: Side) => (typeof own === 'number' ? own : (own?.[name] ?? 0));
  return {
    top: Math.max(side('top'), viewport.top),
    right: side('right'),
    bottom: Math.max(side('bottom'), viewport.bottom),
    left: side('left'),
  };
}

export function useViewportCollisionPadding(): ViewportCollisionPadding {
  return useSyncExternalStore(
    subscribe,
    () => padding,
    () => NONE,
  );
}
