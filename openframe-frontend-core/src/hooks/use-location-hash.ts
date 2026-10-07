'use client';

import { useSyncExternalStore } from 'react';
import { LOCATION_HASH_SYNC_EVENT, normalizeHashFragment } from '../utils/same-page-hash-nav';

/**
 * `navigateSamePageHash` dispatches `hashchange` itself; `popstate` covers back
 * and forward; `replaceLocationHash` (a scroll spy, a tab naming itself)
 * announces its silent writes with its own event.
 */
const HASH_EVENTS = ['hashchange', 'popstate', LOCATION_HASH_SYNC_EVENT] as const;

function subscribe(onChange: () => void): () => void {
  for (const event of HASH_EVENTS) window.addEventListener(event, onChange);
  return () => {
    for (const event of HASH_EVENTS) window.removeEventListener(event, onChange);
  };
}

function readHash(): string {
  const raw = normalizeHashFragment(window.location.hash).replace(/^#/, '');
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * The URL's hash without its `#`, or `''`: the READ side of same-page anchor
 * navigation (`navigateSamePageHash` and `replaceLocationHash` write it,
 * `useScrollToHash` scrolls to it when it was a navigation). For a component whose state follows the anchor: a tab group that opens
 * the tab a link names. Empty on the server and during hydration (the server
 * never sees a hash), then the real one.
 */
export function useLocationHash(): string {
  return useSyncExternalStore(subscribe, readHash, () => '');
}
