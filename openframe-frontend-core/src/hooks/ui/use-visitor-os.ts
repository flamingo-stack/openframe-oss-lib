'use client';

import { useSyncExternalStore } from 'react';
import { detectVisitorOs, type VisitorOs } from '../../utils/visitor-os';

export type VisitorOsState = { known: false; os: null } | { known: true; os: VisitorOs | null };

const UNKNOWN: VisitorOsState = { known: false, os: null };
// One state object per answer, so the snapshot is stable between reads.
const KNOWN = new Map<VisitorOs | null, VisitorOsState>();

const subscribe = () => () => {};
const getServerSnapshot = () => UNKNOWN;
function getSnapshot(): VisitorOsState {
  // `userAgentData` is the Client Hints API (Chromium only, so not in every DOM typing).
  const stated = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform;
  const os = detectVisitorOs(navigator.userAgent, { platform: stated, maxTouchPoints: navigator.maxTouchPoints });
  let state = KNOWN.get(os);
  if (!state) {
    state = { known: true, os };
    KNOWN.set(os, state);
  }
  return state;
}

/**
 * The visitor's system in the browser, through the one detection rule
 * (`utils/visitor-os`). `known` is false on the server and while React
 * hydrates: the server cannot see the browser, and a guess would mismatch.
 */
export function useVisitorOs(): VisitorOsState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
