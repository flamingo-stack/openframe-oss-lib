'use client'

import * as React from 'react'
import type { TimeTrackerData } from './types'

interface TimeTrackerContextValue extends TimeTrackerData {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const TimeTrackerContext = React.createContext<TimeTrackerContextValue | null>(null)

export interface TimeTrackerProviderProps extends TimeTrackerData {
  children: React.ReactNode
  defaultOpen?: boolean
}

export function TimeTrackerProvider({ children, defaultOpen = false, ...data }: TimeTrackerProviderProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)

  const open = React.useCallback(() => setIsOpen(true), [])
  const close = React.useCallback(() => setIsOpen(false), [])
  const toggle = React.useCallback(() => setIsOpen((v) => !v), [])

  // `data` is a fresh object each render, so the value identity tracks the host's
  // render — the per-second timer tick lives in `useTrackerClock` (local state),
  // not here, so consumers don't re-render on every tick.
  const value: TimeTrackerContextValue = { ...data, isOpen, open, close, toggle }

  return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>
}

export function useTimeTracker(): TimeTrackerContextValue {
  const ctx = React.useContext(TimeTrackerContext)
  if (!ctx) {
    throw new Error('useTimeTracker must be used inside <TimeTrackerProvider>')
  }
  return ctx
}

export function useOptionalTimeTracker(): TimeTrackerContextValue | null {
  return React.useContext(TimeTrackerContext)
}
