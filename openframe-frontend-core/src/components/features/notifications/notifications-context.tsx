'use client'

import * as React from 'react'
import type { AddNotificationInput, Notification, RenderNotificationTile } from './types'

interface NotificationsContextValue {
  notifications: Notification[]
  unreadCount: number
  isOpen: boolean
  showPopups: boolean
  addNotification: (input: AddNotificationInput) => string
  upsertNotification: (input: AddNotificationInput & { id: string }) => string
  setNotifications: (list: Notification[]) => void
  markRead: (id: string) => void
  markAllRead: () => void
  markSettled: (id: string) => void
  remove: (id: string) => void
  clear: () => void
  open: () => void
  close: () => void
  toggle: () => void
  setShowPopups: (value: boolean) => void
  /** OS-level notification preference; only meaningful when `desktopPopupsConfigured`. */
  showDesktopPopups: boolean
  setShowDesktopPopups: (value: boolean) => void
  /** True when the host app wired desktop notifications (passed `onShowDesktopPopupsChange`). */
  desktopPopupsConfigured: boolean
  onHistoryClick?: () => void
  hasMore: boolean
  isLoadingMore: boolean
  loadMore?: () => void
  renderTile?: RenderNotificationTile
}

const NotificationsContext = React.createContext<NotificationsContextValue | null>(null)

export interface NotificationsActions {
  /** Called after the local reducer marks an item read; persist server-side. */
  onMarkRead?: (id: string) => void | Promise<void>
  /** Called after the local reducer marks all read; persist server-side. */
  onMarkAllRead?: () => void | Promise<void>
  /** Called after the local reducer removes an item; persist server-side. */
  onRemove?: (id: string) => void | Promise<void>
  /** Called after the local reducer marks an item settled; optional persistence. */
  onMarkSettled?: (id: string) => void | Promise<void>
}

export interface NotificationsProviderProps {
  children: React.ReactNode
  initialNotifications?: Notification[]
  maxNotifications?: number
  defaultShowPopups?: boolean
  onShowPopupsChange?: (value: boolean) => void
  /** Desktop (OS-level) notification preference; providing `onShowDesktopPopupsChange` opts into the drawer toggle. */
  defaultShowDesktopPopups?: boolean
  onShowDesktopPopupsChange?: (value: boolean) => void
  onHistoryClick?: () => void
  actions?: NotificationsActions
  /** Pagination — when omitted, the drawer hides its load-more sentinel. */
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
  /** Override how individual tiles render (drawer + popups); falls back to `NotificationTile`. */
  renderTile?: RenderNotificationTile
}

type Action =
  | { type: 'add'; notification: Notification; max: number }
  | { type: 'upsert'; notification: Notification; max: number }
  | { type: 'set'; notifications: Notification[] }
  | { type: 'markRead'; id: string }
  | { type: 'markAllRead' }
  | { type: 'markSettled'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'clear' }

function mergeNotification(base: Notification, incoming: Notification): Notification {
  const out: Notification = { ...base }
  for (const key of Object.keys(incoming) as (keyof Notification)[]) {
    const value = incoming[key]
    if (value !== undefined) (out as unknown as Record<string, unknown>)[key] = value
  }

  out.read = (incoming.read ?? false) || (base.read ?? false) || false
  out.settled = (incoming.settled ?? false) || (base.settled ?? false) || false
  return out
}

function reducer(state: Notification[], action: Action): Notification[] {
  switch (action.type) {
    case 'add': {
      const existing = state.find((n) => n.id === action.notification.id)
      if (existing) {
        const merged = mergeNotification(existing, action.notification)
        return [merged, ...state.filter((n) => n.id !== action.notification.id)]
      }
      const next = [action.notification, ...state]
      return next.length > action.max ? next.slice(0, action.max) : next
    }
    case 'upsert': {
      const existing = state.find((n) => n.id === action.notification.id)
      if (existing) {
        const merged = mergeNotification(existing, action.notification)
        return state.map((n) => (n.id === action.notification.id ? merged : n))
      }
      const next = [action.notification, ...state]
      return next.length > action.max ? next.slice(0, action.max) : next
    }
    case 'set': {
      const existingById = new Map(state.map((n) => [n.id, n]))
      return action.notifications.map((incoming) => {
        const existing = existingById.get(incoming.id)
        if (!existing) return incoming
        return {
          ...incoming,
          read: incoming.read || existing.read,
          settled: incoming.settled || existing.settled,
        }
      })
    }
    case 'markRead':
      return state.map((n) => (n.id === action.id ? { ...n, read: true } : n))
    case 'markAllRead':
      return state.map((n) => (n.read ? n : { ...n, read: true }))
    case 'markSettled':
      return state.map((n) => (n.id === action.id && !n.settled ? { ...n, settled: true } : n))
    case 'remove':
      return state.filter((n) => n.id !== action.id)
    case 'clear':
      return []
    default:
      return state
  }
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function NotificationsProvider({
  children,
  initialNotifications = [],
  maxNotifications = 50,
  defaultShowPopups = true,
  onShowPopupsChange,
  defaultShowDesktopPopups = false,
  onShowDesktopPopupsChange,
  onHistoryClick,
  actions,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  renderTile,
}: NotificationsProviderProps) {
  const [notifications, dispatch] = React.useReducer(reducer, initialNotifications)
  const [isOpen, setIsOpen] = React.useState(false)
  const [showPopups, setShowPopupsState] = React.useState(defaultShowPopups)
  const [showDesktopPopups, setShowDesktopPopupsState] = React.useState(defaultShowDesktopPopups)
  const desktopPopupsConfigured = onShowDesktopPopupsChange !== undefined

  const actionsRef = React.useRef(actions)
  React.useEffect(() => {
    actionsRef.current = actions
  }, [actions])

  const addNotification = React.useCallback(
    (input: AddNotificationInput) => {
      const id = input.id ?? generateId()
      const notification: Notification = {
        ...input,
        id,
        createdAt: input.createdAt ?? Date.now(),
        read: input.read ?? false,
      }
      dispatch({ type: 'add', notification, max: maxNotifications })
      return id
    },
    [maxNotifications],
  )

  const upsertNotification = React.useCallback(
    (input: AddNotificationInput & { id: string }) => {
      const notification: Notification = {
        ...input,
        id: input.id,
        createdAt: input.createdAt ?? Date.now(),
        read: input.read ?? false,
      }
      dispatch({ type: 'upsert', notification, max: maxNotifications })
      return input.id
    },
    [maxNotifications],
  )

  const setNotifications = React.useCallback((list: Notification[]) => {
    dispatch({ type: 'set', notifications: list })
  }, [])

  const markRead = React.useCallback((id: string) => {
    dispatch({ type: 'markRead', id })
    void actionsRef.current?.onMarkRead?.(id)
  }, [])

  const markAllRead = React.useCallback(() => {
    dispatch({ type: 'markAllRead' })
    void actionsRef.current?.onMarkAllRead?.()
  }, [])

  const markSettled = React.useCallback((id: string) => {
    dispatch({ type: 'markSettled', id })
    void actionsRef.current?.onMarkSettled?.(id)
  }, [])

  const remove = React.useCallback((id: string) => {
    dispatch({ type: 'remove', id })
    void actionsRef.current?.onRemove?.(id)
  }, [])

  const clear = React.useCallback(() => dispatch({ type: 'clear' }), [])

  const open = React.useCallback(() => setIsOpen(true), [])
  const close = React.useCallback(() => setIsOpen(false), [])
  const toggle = React.useCallback(() => setIsOpen((v) => !v), [])

  const setShowPopups = React.useCallback(
    (value: boolean) => {
      setShowPopupsState(value)
      onShowPopupsChange?.(value)
    },
    [onShowPopupsChange],
  )

  const setShowDesktopPopups = React.useCallback(
    (value: boolean) => {
      setShowDesktopPopupsState(value)
      onShowDesktopPopupsChange?.(value)
    },
    [onShowDesktopPopupsChange],
  )

  const unreadCount = React.useMemo(
    () => notifications.reduce((acc, n) => (n.read ? acc : acc + 1), 0),
    [notifications],
  )

  const value = React.useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      isOpen,
      showPopups,
      addNotification,
      upsertNotification,
      setNotifications,
      markRead,
      markAllRead,
      markSettled,
      remove,
      clear,
      open,
      close,
      toggle,
      setShowPopups,
      showDesktopPopups,
      setShowDesktopPopups,
      desktopPopupsConfigured,
      onHistoryClick,
      hasMore,
      isLoadingMore,
      loadMore: onLoadMore,
      renderTile,
    }),
    [
      notifications,
      unreadCount,
      isOpen,
      showPopups,
      showDesktopPopups,
      setShowDesktopPopups,
      desktopPopupsConfigured,
      addNotification,
      upsertNotification,
      setNotifications,
      markRead,
      markAllRead,
      markSettled,
      remove,
      clear,
      open,
      close,
      toggle,
      setShowPopups,
      onHistoryClick,
      hasMore,
      isLoadingMore,
      onLoadMore,
      renderTile,
    ],
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications(): NotificationsContextValue {
  const ctx = React.useContext(NotificationsContext)
  if (!ctx) {
    throw new Error('useNotifications must be used inside <NotificationsProvider>')
  }
  return ctx
}

export function useOptionalNotifications(): NotificationsContextValue | null {
  return React.useContext(NotificationsContext)
}
