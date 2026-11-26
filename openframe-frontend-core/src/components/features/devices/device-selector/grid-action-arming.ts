import { createContext, type MouseEvent } from 'react';

const NOOP = () => {};

/** How long after the first tap a second one is still the same tap (a double tap's ghost), not a confirmation. */
export const TOUCH_CONFIRM_GUARD_MS = 350;

/**
 * The grid's armed add / remove button. On a touch screen the first tap on it shows its tooltip ("Add <device>") and
 * applies nothing; the second tap applies. One at a time, held by the picker.
 */
export interface ArmedGridAction {
  /** The table's row id. */
  rowId: string;
  /** What the button does to which device, "Add <device>": a row whose action flipped is no longer armed. */
  label: string;
  /** What a screen reader hears once it is armed ("Tap again to add <device>"). None for a disabled row's reason. */
  hint?: string;
  /** When it was armed (`Date.now()`), for {@link TOUCH_CONFIRM_GUARD_MS}. */
  at: number;
}

export interface GridActionArming {
  armed: ArmedGridAction | null;
  arm: (next: ArmedGridAction) => void;
  /** Clears the armed button: any, or only `match` (a bubble closing clears its own row, never another). */
  disarm: (match?: Pick<ArmedGridAction, 'rowId' | 'label'>) => void;
}

export const GridActionArmingContext = createContext<GridActionArming>({ armed: null, arm: NOOP, disarm: NOOP });

/**
 * Whether a click came from a finger: the click's own `pointerType` where the browser sends it as a PointerEvent, else
 * the last `pointerdown`'s (older WebKit sends a tap's click as a plain MouseEvent). A keyboard's click (`detail` 0) is
 * never a tap.
 */
export function isTouchClick(event: MouseEvent<HTMLElement>, lastPointerType: string | undefined): boolean {
  if (event.detail === 0) return false;
  const native = event.nativeEvent;
  const own = typeof PointerEvent !== 'undefined' && native instanceof PointerEvent ? native.pointerType : '';
  return (own || lastPointerType) === 'touch';
}
