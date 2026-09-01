'use client';

import { createContext, useContext } from 'react';

/**
 * True inside the `ActionsMenu` header row (see `actions-menu.tsx`).
 *
 * The header hosts controls that elsewhere carry their own frame — the view
 * `TabSelector` above all — and the menu design renders them FLUSH: no border,
 * no radius, no inner padding, segments edge to edge, with the menu's own row
 * border and rounding doing the framing. The context lets such a control adapt
 * itself, so the same node a page puts in its title bar needs no re-styling to
 * appear inside the mobile "…" menu.
 *
 * Its own module (not `actions-menu.tsx`) so a control reading it does not pull
 * the whole dropdown stack into every bundle that renders the control.
 */
export const ActionsMenuHeaderContext = createContext(false);

/** Whether this render sits inside an `ActionsMenu` header row. */
export function useIsInActionsMenuHeader(): boolean {
  return useContext(ActionsMenuHeaderContext);
}
