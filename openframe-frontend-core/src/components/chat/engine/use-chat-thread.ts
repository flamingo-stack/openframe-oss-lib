'use client';

/**
 * useChatThread: a React view of one key of a `ChatThreadStore`. The store outlives the component; the hook only
 * subscribes, and pins the key against eviction while it is on screen.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { ChatThreadSnapshot, ChatThreadStore } from './chat-thread-store';

export function useChatThread<K extends string>(store: ChatThreadStore<K>, key: K): ChatThreadSnapshot {
  const getSnapshot = useCallback(() => store.snapshotOf(key), [store, key]);
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // A thread on screen is never evicted: a replacement reducer would publish an empty one.
  const { dialogId, side } = store.identityOf(key);
  useEffect(() => store.store.retain(dialogId, side), [store, dialogId, side]);

  return snapshot;
}
