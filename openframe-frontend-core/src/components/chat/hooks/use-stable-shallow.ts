'use client';

/**
 * useStableShallow — keep the PREVIOUS reference for a value whose contents did
 * not change, so an inline object literal from a host can be used as a
 * dependency without invalidating everything downstream of it on every render.
 *
 * Hosts write props inline (`mingoDialogCapabilities={{ canRename: true, … }}`),
 * which is a fresh object each render. Feed one into a `useMemo` dependency and
 * that memo — and anything memoized on its result — recomputes forever. This
 * latches the reference and only swaps it when a shallow comparison of the
 * OWN enumerable keys actually differs.
 *
 * Shallow by design: the values inside are compared with `Object.is`, so a host
 * whose callbacks are themselves recreated each render still churns. That is
 * the host's own instability, visible to it, and not something this hook can or
 * should paper over by comparing more deeply.
 */

import { useState } from 'react';

function shallowEqual(a: object, b: object): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  const aRec = a as Record<string, unknown>;
  const bRec = b as Record<string, unknown>;
  // `in` rather than `b[key] !== undefined`, so an explicitly-undefined key on
  // one side and a missing key on the other are correctly NOT equal.
  return aKeys.every(key => key in b && Object.is(aRec[key], bRec[key]));
}

// `object`, not `Record<string, unknown>`: an interface without an index
// signature (every capability/props type in this codebase) is not assignable to
// the latter, which would make the hook unusable for exactly its intended
// callers.
export function useStableShallow<T extends object | undefined>(value: T): T {
  // Adjusting state during render — the documented React pattern for deriving
  // from a prop — guarded so the extra pass takes the early exit. A ref written
  // during render would be unsafe under concurrent rendering.
  const [cached, setCached] = useState<T>(value);
  const same = cached === value || (cached !== undefined && value !== undefined && shallowEqual(cached, value));
  if (!same) setCached(value);
  // The pass that stores `value` also returns it, so callers never see a stale
  // object for a render.
  return same ? cached : value;
}
