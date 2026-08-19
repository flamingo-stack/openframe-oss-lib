'use client'

import { useCallback, useRef, useState } from 'react'
import { useLocalStorage } from '../../../hooks/ui/use-local-storage'

export type BoardCollapseMap = Record<string, boolean>

export interface UseBoardCollapseReturn {
  collapsed: BoardCollapseMap
  toggle: (columnId: string) => void
  setCollapsed: (columnId: string, value: boolean) => void
}

export function useBoardCollapse(storageKey?: string): UseBoardCollapseReturn {
  const [persisted, setPersisted] = useLocalStorage<BoardCollapseMap>(
    storageKey ?? '__board_collapse_unused__',
    {},
  )
  const [memory, setMemory] = useState<BoardCollapseMap>({})

  const collapsed = storageKey ? persisted : memory
  const setMap = storageKey ? setPersisted : setMemory

  // Both callbacks keep one identity for the hook's lifetime. `useLocalStorage`
  // returns an unmemoized setter, so depending on it directly hands the board a
  // new `toggle` on every render — and a board that memoizes its columns then
  // re-renders all of them on every drag frame, which is the one thing the memo
  // is there to prevent. The ref keeps the latest setter without the identity.
  const setMapRef = useRef(setMap)
  setMapRef.current = setMap

  const toggle = useCallback((columnId: string) => {
    setMapRef.current(prev => ({ ...prev, [columnId]: !prev[columnId] }))
  }, [])

  const setCollapsed = useCallback((columnId: string, value: boolean) => {
    setMapRef.current(prev => ({ ...prev, [columnId]: value }))
  }, [])

  return { collapsed, toggle, setCollapsed }
}
