'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { createLocalStorageAdapter } from '../../utils/local-storage-adapter';
import { readLocalStorageUpdateDetail } from '../../utils/storage-event';

export interface UseLocalStorageOptions<T> {
  /**
   * Runtime shape check applied to every value decoded from storage — the
   * first read and each cross-tab update. Returning false discards the stored
   * value and falls back to `initialValue`.
   *
   * Without it the stored JSON is trusted to be a `T`, which only holds while
   * nothing else writes the key and the persisted shape never changes. Pass a
   * guard for anything whose shape has versions.
   *
   * Keep the identity stable (module scope or `useCallback`) — an inline
   * predicate re-subscribes the cross-tab listeners on every render.
   */
  validate?: (parsed: unknown) => parsed is T;
}

/**
 * Hook to use localStorage with state
 * @param key - localStorage key
 * @param initialValue - Initial value if key doesn't exist
 * @param options - Optional `validate` guard for the stored payload
 * @returns [storedValue, setValue] tuple
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: UseLocalStorageOptions<T>,
): [T, (value: T | ((val: T) => T)) => void] {
  // Latest `initialValue` for the "key was cleared elsewhere" reset path. It
  // cannot be an effect dependency: the listeners register once per `key`, and
  // any caller passing an object or array literal would re-subscribe on every
  // render.
  const initialValueRef = useRef(initialValue);
  useEffect(() => {
    initialValueRef.current = initialValue;
  });

  // Single decode path — SSR guard, JSON parse, validation and the quota-safe
  // write all live in the adapter, so nothing here re-implements them.
  const validate = options?.validate;
  const storage = useMemo(
    () => createLocalStorageAdapter<T>({ key, validate, logTag: `[useLocalStorage:${key}]` }),
    [key, validate],
  );

  // Lazy initialization reads from localStorage synchronously on first render.
  const [storedValue, setStoredValue] = useState<T>(() => storage.load() ?? initialValue);

  // Use a ref to track if we've initialized from localStorage
  const isInitialized = useRef(true); // Set to true since we initialize in useState
  // Use a ref to track if the current state change came from a storage event
  const isFromStorageEvent = useRef(false);

  // Listen for storage events to sync with other tabs/components
  useEffect(() => {
    if (!isInitialized.current) return undefined;

    // Both events only say "this key changed"; the value is read back through
    // the adapter so the payload is decoded and validated in exactly one place.
    // A removed key reads back as null and resets to `initialValue`, whichever
    // event reported it.
    const syncFromStorage = (source: string) => {
      const next = storage.load();
      isFromStorageEvent.current = true;
      setStoredValue(next ?? initialValueRef.current);
      console.log(`🔄 ${next === null ? 'Cleared' : 'Updated'} localStorage key "${key}" from ${source}`);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== key) return;
      syncFromStorage('storage event');
    };

    const handleCustomStorageUpdate = (event: Event) => {
      const detail = readLocalStorageUpdateDetail(event);
      if (detail?.key !== key) return;
      syncFromStorage('custom storage event');
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localStorageUpdate', handleCustomStorageUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageUpdate', handleCustomStorageUpdate);
    };
  }, [key, storage]);

  // Update localStorage when state changes, but only after initialization and NOT from storage events
  useEffect(() => {
    if (!isInitialized.current) return;

    // Skip localStorage write if this state change came from a storage event
    if (isFromStorageEvent.current) {
      isFromStorageEvent.current = false;
      return;
    }

    storage.save(storedValue);
  }, [storage, storedValue]);

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      // Save state
      setStoredValue(valueToStore);
    } catch (error) {
      console.error(`Error setting value for localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}
