'use client'

import * as React from 'react'
import type { AddNotificationInput, Notification } from './types'

interface NotificationsContextValue {
  notifications: Notification[]
  unreadCount: number
  isOpen: boolean
  showPopups: boolean
  addNotification: (input: AddNotificationInput) => string
  markRead: (id: string) => void
  markAllRead: () => void
  markSettled: (id: string) => void
  remove: (id: string) => void
  clear: () => void
  open: () => void
  close: () => void
  toggle: () => void
  setShowPopups: (value: boolean) => void
  onHistoryClick?: () => void
}

const NotificationsContext = React.createContext<NotificationsContextValue | null>(null)

export interface NotificationsProviderProps {
  children: React.ReactNode
  initialNotifications?: Notification[]
  maxNotifications?: number
  defaultShowPopups?: boolean
  onShowPopupsChange?: (value: boolean) => void
  onHistoryClick?: () => void
}

type Action =
  | { type: 'add'; notification: Notification; max: number }
  | { type: 'markRead'; id: string }
  | { type: 'markAllRead' }
  | { type: 'markSettled'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'clear' }

function reducer(state: Notification[], action: Action): Notification[] {
  switch (action.type) {
    case 'add': {
      const next = [action.notification, ...state.filter((n) => n.id !== action.notification.id)]
      return next.length > action.max ? next.slice(0, action.max) : next
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
  onHistoryClick,
}: NotificationsProviderProps) {
  const [notifications, dispatch] = React.useReducer(reducer, initialNotifications)
  const [isOpen, setIsOpen] = React.useState(false)
  const [showPopups, setShowPopupsState] = React.useState(defaultShowPopups)

  const addNotification = React.useCallback(
    (input: AddNotificationInput) => {
      const id = input.id ?? generateId()
      const notification: Notification = {
        ...input,
        id,
        createdAt: input.createdAt ?? Date.now(),
        read: false,
      }
      dispatch({ type: 'add', notification, max: maxNotifications })
      return id
    },
    [maxNotifications],
  )

  const markRead = React.useCallback((id: string) => dispatch({ type: 'markRead', id }), [])
  const markAllRead = React.useCallback(() => dispatch({ type: 'markAllRead' }), [])
  const markSettled = React.useCallback((id: string) => dispatch({ type: 'markSettled', id }), [])
  const remove = React.useCallback((id: string) => dispatch({ type: 'remove', id }), [])
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
    }),
    [
      notifications,
      unreadCount,
      isOpen,
      showPopups,
      addNotification,
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
