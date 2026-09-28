'use client';

import { type ReactNode, createContext, useCallback, useContext, useState } from 'react';
import type { TimeTrackerData } from './types';

interface TimeTrackerContextValue extends TimeTrackerData {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const TimeTrackerContext = createContext<TimeTrackerContextValue | null>(null);

export interface TimeTrackerProviderProps extends TimeTrackerData {
  children: ReactNode;
  defaultOpen?: boolean;
  /**
   * Whether the tracker is available to this host at all (feature flag, session,
   * entitlement). `false` provides NO context — `useOptionalTimeTracker()` reads
   * `null` and every surface hides itself, exactly as if this provider were absent.
   *
   * It exists so a host never has to mount this CONDITIONALLY. A host that writes
   * `enabled ? <TimeTrackerProvider>{children}</TimeTrackerProvider> : <>{children}</>`
   * changes the element TYPE at that position the moment its flag answers, and React
   * tears down and remounts everything below — the whole app shell, in the case this
   * was added for. Mount it always and pass the answer here instead.
   */
  enabled?: boolean;
}

export function TimeTrackerProvider({
  children,
  defaultOpen = false,
  enabled = true,
  ...data
}: TimeTrackerProviderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(v => !v), []);

  // `data` is a fresh object each render, so the value identity tracks the host's
  // render — the per-second timer tick lives in `useTrackerClock` (local state),
  // not here, so consumers don't re-render on every tick.
  const value: TimeTrackerContextValue = { ...data, isOpen, open, close, toggle };

  return <TimeTrackerContext.Provider value={enabled ? value : null}>{children}</TimeTrackerContext.Provider>;
}

export function useTimeTracker(): TimeTrackerContextValue {
  const ctx = useContext(TimeTrackerContext);
  if (!ctx) {
    throw new Error('useTimeTracker must be used inside <TimeTrackerProvider>');
  }
  return ctx;
}

export function useOptionalTimeTracker(): TimeTrackerContextValue | null {
  return useContext(TimeTrackerContext);
}
