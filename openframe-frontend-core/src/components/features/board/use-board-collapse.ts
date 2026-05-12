'use client'

import { useCallback, useState } from 'react'
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

  const toggle = useCallback(
    (columnId: string) => {
      setMap(prev => ({ ...prev, [columnId]: !prev[columnId] }))
    },
    [setMap],
  )

  const setCollapsed = useCallback(
    (columnId: string, value: boolean) => {
      setMap(prev => ({ ...prev, [columnId]: value }))
    },
    [setMap],
  )

  return { collapsed, toggle, setCollapsed }
}
