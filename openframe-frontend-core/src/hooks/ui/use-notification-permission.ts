'use client'

import { useCallback, useEffect, useState } from 'react'

export interface UseNotificationPermissionResult {
  /** Whether the page-context Notification API exists in this browser (false during SSR and on iOS Safari). */
  supported: boolean
  permission: NotificationPermission
  /** Prompt the user for permission. Must be called from a user gesture or browsers will auto-deny. */
  request: () => Promise<NotificationPermission>
}

/**
 * Tracks the browser's desktop-notification permission, staying in sync when
 * the user changes the site setting externally (Permissions API change event
 * where available, visibility/focus re-read as the Safari fallback).
 */
export function useNotificationPermission(): UseNotificationPermissionResult {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    setSupported(true)
    const sync = () => setPermission(Notification.permission)
    sync()

    let status: PermissionStatus | undefined
    navigator.permissions
      ?.query({ name: 'notifications' as PermissionName })
      .then((s) => {
        status = s
        s.addEventListener('change', sync)
      })
      .catch(() => undefined)

    document.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    return () => {
      status?.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('focus', sync)
    }
  }, [])

  const request = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied' as NotificationPermission
    }
    // Older Safari only implements the callback form; resolving from both is harmless.
    const result = await new Promise<NotificationPermission>((resolve) => {
      const maybePromise = Notification.requestPermission(resolve)
      if (maybePromise && typeof maybePromise.then === 'function') void maybePromise.then(resolve)
    })
    setPermission(Notification.permission)
    return result
  }, [])

  return { supported, permission, request }
}
