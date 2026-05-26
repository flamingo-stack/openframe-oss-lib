import type { ReactNode } from 'react'

export type NotificationVariant = 'default' | 'success' | 'warning' | 'error' | 'info'

export type NotificationSeverity = 'INFO' | 'WARNING' | 'DANGER'

export interface Notification {
  id: string
  variant?: NotificationVariant
  title: ReactNode
  description?: ReactNode
  createdAt: number
  read?: boolean
  settled?: boolean
  severity?: NotificationSeverity
  /** Free-form category tag (e.g. backend NotificationCategory enum value). */
  category?: string
  meta?: Record<string, unknown>
}

export type AddNotificationInput =
  Omit<Notification, 'id' | 'createdAt' | 'read' | 'settled'> & {
    id?: string
    createdAt?: number
    read?: boolean
  }
