import type { ReactNode } from 'react'

export type NotificationVariant = 'default' | 'success' | 'warning' | 'error' | 'info'

export interface Notification {
  id: string
  variant?: NotificationVariant
  title: ReactNode
  description?: ReactNode
  createdAt: number
  read?: boolean
  settled?: boolean
  meta?: Record<string, unknown>
}

export type AddNotificationInput =
  Omit<Notification, 'id' | 'createdAt' | 'read' | 'settled'> & {
    id?: string
    createdAt?: number
  }
