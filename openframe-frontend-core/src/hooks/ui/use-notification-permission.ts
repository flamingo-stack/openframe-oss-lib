'use client';

import { useCallback, useEffect, useState } from 'react';

export interface UseNotificationPermissionResult {
  /** Whether the page-context Notification API exists in this browser (false during SSR and on iOS Safari). */
  supported: boolean;
  permission: NotificationPermission;
  /** Prompt the user for permission. Must be called from a user gesture or browsers will auto-deny. */
  request: () => Promise<NotificationPermission>;
}

/**
 * Tracks the browser's desktop-notification permission, staying in sync when
 * the user changes the site setting externally (Permissions API change event
 * where available, visibility/focus re-read as the Safari fallback).
 */
export function useNotificationPermission(): UseNotificationPermissionResult {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return undefined;
    // Both values are reads of an external system (the browser's permission
    // store), so they belong in the same sync callback rather than as a
    // separate mount-time setState: `supported` cannot be computed during
    // render without a hydration mismatch, and folding it into `sync` means the
    // initial read costs one render instead of two. Re-syncs are free — React
    // bails out when the next value is identical, which it is for every
    // visibility/focus event that did not actually change the permission.
    const sync = () => {
      setSupported(true);
      setPermission(Notification.permission);
    };
    sync();

    // The query resolves async; without the flag it would attach the listener after unmount.
    let cancelled = false;
    let status: PermissionStatus | undefined;
    navigator.permissions
      ?.query({ name: 'notifications' })
      .then(s => {
        if (cancelled) return;
        status = s;
        s.addEventListener('change', sync);
      })
      .catch(() => undefined);

    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      cancelled = true;
      status?.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const request = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    // Older Safari only implements the callback form; resolving from both is harmless.
    // The DOM lib types `requestPermission` as always returning a promise, so testing
    // the value itself is a conditional on something the types call always-truthy —
    // the thenable probe is the check that actually means something at runtime, since
    // the callback-only implementations return undefined here.
    const result = await new Promise<NotificationPermission>(resolve => {
      const maybePromise = Notification.requestPermission(resolve);
      if (typeof maybePromise?.then === 'function') {
        // A rejection here would otherwise leave this promise forever pending, and
        // `request()` never settles: the caller's permission toggle silently stays
        // off. Fall back to whatever the browser currently reports.
        void maybePromise.then(resolve, () => resolve(Notification.permission));
      }
    });
    setPermission(Notification.permission);
    return result;
  }, []);

  return { supported, permission, request };
}
