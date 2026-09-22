'use client';

import { useSyncExternalStore } from 'react';

// The "store" is a constant, so there is nothing to subscribe to and nothing to
// unsubscribe from. Module-level so no consumer can re-subscribe by passing a
// fresh closure on every render.
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * `false` while the server renders and while React hydrates; `true` from the
 * first client render after hydration. The gate for anything that must not
 * appear in the SSR HTML — browser-only APIs, persisted preferences, values
 * read from `localStorage` or `document`.
 *
 * This replaces the `useState(false)` + `useEffect(() => setMounted(true), [])`
 * idiom. Same one extra render, same hydration safety, but the flag is not
 * state anyone owns and there is no synchronous `setState` inside an effect
 * body — the thing `react-hooks/set-state-in-effect` (React Compiler) reports,
 * because that shape forces a second render pass that React cannot batch away.
 *
 * `useSyncExternalStore` is React's own mechanism for this: hydration renders
 * `getServerSnapshot`, and React re-reads `getSnapshot` immediately afterwards
 * and re-renders when the two disagree — which here they always do. In a
 * client-only render (no SSR) there is no hydration pass at all, so this is
 * `true` on the very first render and nothing flashes.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
