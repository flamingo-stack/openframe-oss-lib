import type { ReactNode } from 'react';
import type { NavigationSidebarSlot, NavigationSidebarSlotState } from '../../types/navigation';

/** Whether the host passed anything to draw — `false` / `null` count as nothing, like in JSX. */
export function hasNavigationSidebarSlot(slot: NavigationSidebarSlot | undefined): slot is NavigationSidebarSlot {
  return slot !== undefined && slot !== null && slot !== false;
}

/** A slot's content for the sidebar's current state (see `NavigationSidebarSlot`). */
export function renderNavigationSidebarSlot(slot: NavigationSidebarSlot, state: NavigationSidebarSlotState): ReactNode {
  return typeof slot === 'function' ? slot(state) : slot;
}
