'use client';

import { useState } from 'react';

/**
 * Bookkeeping shared by the pickers that can search on the server
 * (`Autocomplete` / `SearchableSelect` with `onSearchChange`). There the
 * caller's `options` ARE the server's answer to the current query, so the
 * picker filters nothing; what it still owes the user is a list that holds
 * still between keystrokes and a selection that keeps its label.
 *
 * Both hooks take `enabled` and are inert without it, so a client-filtered
 * picker pays nothing and behaves exactly as before.
 */

/**
 * The options to list. While the next answer is in flight (`isLoading`), a
 * caller that already emptied `options` would blank the list — or flash its
 * "no results" line — on every keystroke, so an empty list falls back to the
 * last one that settled. A caller that keeps the previous answer through the
 * load (a transition, a placeholder) passes through untouched, and an empty
 * answer that has settled is shown as the empty state it is.
 */
export function useSettledOptions<O>(options: O[], isLoading: boolean, enabled: boolean): O[] {
  const [settled, setSettled] = useState(options);
  // Adjusted while rendering, not from an effect: the list is drawn from this
  // render's value, so an effect would paint one frame of the stale snapshot.
  // Guarded on identity, so the pass React schedules for it takes the exit.
  if (enabled && !isLoading && settled !== options) setSettled(options);
  return enabled && isLoading && options.length === 0 ? settled : options;
}

/**
 * The last option seen for each selected value. A server search replaces
 * `options` on every query, and a selection the current answer does not
 * include would otherwise lose its label and icon. Holds the selected values
 * only — a value that is deselected is forgotten — so it never outgrows the
 * selection.
 */
export function useRememberedSelection<T, O extends { value: T }>(
  options: readonly O[],
  selected: readonly T[],
  enabled: boolean,
): ReadonlyMap<T, O> {
  const [remembered, setRemembered] = useState<ReadonlyMap<T, O>>(() => new Map());
  if (enabled) {
    const next = new Map<T, O>();
    for (const value of selected) {
      const option = options.find(o => o.value === value) ?? remembered.get(value);
      if (option) next.set(value, option);
    }
    // Same render-time adjustment as above; identity-compared entries, so the
    // re-run with the same props computes an equal map and stops.
    if (!hasSameEntries(next, remembered)) setRemembered(next);
  }
  return remembered;
}

function hasSameEntries<K, V>(a: ReadonlyMap<K, V>, b: ReadonlyMap<K, V>): boolean {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) {
    if (b.get(key) !== value) return false;
  }
  return true;
}
